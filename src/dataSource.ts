import * as cp from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { ExtensionState } from './extensionState';
import { GitCommandStatus, GitCommit, GitCommitDetails, GitCommitNode, GitFileChangeType, GitRefData, GitRepoSet, GitResetMode, GitUnsavedChanges } from './types';

const eolRegex = /\r\n|\r|\n/g;
const headRegex = /^\(HEAD detached at [0-9A-Za-z]+\)/g;
const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export class DataSource {
	private readonly extensionState: ExtensionState;
	private gitPath!: string;
	private gitExecPath!: string;
	private gitLogFormat!: string;
	private gitCommitDetailsFormat!: string;

	constructor(extensionState: ExtensionState) {
		this.extensionState = extensionState;
		this.registerGitPath();
		this.generateGitCommandFormats();
	}

	public registerGitPath() {
		this.gitPath = getConfig().gitPath();
		this.gitExecPath = this.gitPath.indexOf(' ') > -1 ? '"' + this.gitPath + '"' : this.gitPath;
	}

	public generateGitCommandFormats() {
		let dateType = getConfig().dateType() === 'Author Date' ? '%at' : '%ct';
		this.gitLogFormat = ['%H', '%P', '%an', '%ae', dateType, '%s'].join(gitLogSeparator);
		this.gitCommitDetailsFormat = ['%H', '%P', '%an', '%ae', dateType, '%cn'].join(gitLogSeparator) + '%n%B';
	}

	public async getRepos() {
		let rootFolders = vscode.workspace.workspaceFolders, repoConfig = this.extensionState.getRepoConfig();
		let repos: GitRepoSet = {}, i, path;
		if (typeof rootFolders !== 'undefined') {
			for (i = 0; i < rootFolders.length; i++) {
				path = rootFolders[i].uri.fsPath.replace(/\\/g, '/');
				if (await this.isGitRepository(path)) repos[path] = typeof repoConfig[path] !== 'undefined' ? repoConfig[path] : { columnWidths: null };
			}
		}
		return repos;
	}

	public getBranches(repo: string, showRemoteBranches: boolean) {
		return new Promise<{ branches: string[], head: string | null }>((resolve) => {
			this.execGit('branch' + (showRemoteBranches ? ' -a' : ''), repo, (err, stdout) => {
				let branchData = {
					branches: <string[]>[],
					head: <string | null>null
				};

				if (!err) {
					let lines = stdout.split(eolRegex);
					for (let i = 0; i < lines.length - 1; i++) {
						let name = lines[i].substring(2).split(' -> ')[0];
						if (name.match(headRegex) !== null) continue;

						if (lines[i][0] === '*') {
							branchData.head = name;
							branchData.branches.unshift(name);
						} else {
							branchData.branches.push(name);
						}
					}
				}
				resolve(branchData);
			});
		});
	}

	public async getCommits(repo: string, branch: string, maxCommits: number, showRemoteBranches: boolean) {
		let commits = await this.getGitLog(repo, branch, maxCommits + 1, showRemoteBranches);
		let refData = await this.getRefs(repo, showRemoteBranches);
		let i, unsavedChanges = null;

		let moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

		if (refData.head !== null) {
			for (i = 0; i < commits.length; i++) {
				if (refData.head === commits[i].hash) {
					unsavedChanges = getConfig().showUncommittedChanges() ? await this.getGitUnsavedChanges(repo) : null;
					if (unsavedChanges !== null) {
						commits.unshift({ hash: '*', parentHashes: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
					}
					break;
				}
			}
		}

		let commitNodes: GitCommitNode[] = [];
		let commitLookup: { [hash: string]: number } = {};

		for (i = 0; i < commits.length; i++) {
			commitLookup[commits[i].hash] = i;
			commitNodes.push({ hash: commits[i].hash, parentHashes: commits[i].parentHashes, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: [] });
		}
		for (i = 0; i < refData.refs.length; i++) {
			if (typeof commitLookup[refData.refs[i].hash] === 'number') {
				commitNodes[commitLookup[refData.refs[i].hash]].refs.push(refData.refs[i]);
			}
		}

		return { commits: commitNodes, head: refData.head, moreCommitsAvailable: moreCommitsAvailable };
	}

	public async commitDetails(repo: string, commitHash: string) {
		try {
			let details = await new Promise<GitCommitDetails>((resolve, reject) => {
				this.execGit('show --quiet ' + commitHash + ' --format="' + this.gitCommitDetailsFormat + '"', repo, (err, stdout) => {
					if (!err) {
						let lines = stdout.split(eolRegex), lastLine = lines.length - 1;
						while (lines.length > 0 && lines[lastLine] === '') lastLine--;
						let commitInfo = lines[0].split(gitLogSeparator);
						resolve({
							hash: commitInfo[0],
							parents: commitInfo[1].split(' '),
							author: commitInfo[2],
							email: commitInfo[3],
							date: parseInt(commitInfo[4]),
							committer: commitInfo[5],
							body: lines.slice(1, lastLine + 1).join('\n'),
							fileChanges: []
						});
					} else {
						reject();
					}
				});
			});
			let fileLookup: { [file: string]: number } = {};
			await new Promise((resolve, reject) => {
				this.execGit('diff-tree --name-status -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, repo, (err, stdout) => {
					if (!err) {
						let lines = stdout.split(eolRegex);
						for (let i = 1; i < lines.length - 1; i++) {
							let line = lines[i].split('\t');
							if (line.length < 2) break;
							let oldFilePath = line[1].replace(/\\/g, '/'), newFilePath = line[line.length - 1].replace(/\\/g, '/');
							fileLookup[newFilePath] = details.fileChanges.length;
							details.fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
						}
						resolve();
					} else {
						reject();
					}
				});
			});
			await new Promise((resolve, reject) => {
				this.execGit('diff-tree --numstat -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, repo, (err, stdout) => {
					if (!err) {
						let lines = stdout.split(eolRegex);
						for (let i = 1; i < lines.length - 1; i++) {
							let line = lines[i].split('\t');
							if (line.length !== 3) break;
							let fileName = line[2].replace(/(.*){.* => (.*)}/, '$1$2').replace(/.* => (.*)/, '$1');
							if (typeof fileLookup[fileName] === 'number') {
								details.fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
								details.fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
							}
						}
						resolve();
					} else {
						reject();
					}

				});
			});
			return details;
		} catch (e) {
			return null;
		}
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string) {
		return this.spawnGit(['show', commitHash + ':' + filePath], repo, stdout => stdout, '');
	}

	public async getRemoteUrl(repo: string) {
		return new Promise<string | null>(resolve => {
			this.execGit('config --get remote.origin.url', repo, (err, stdout) => {
				resolve(!err ? stdout.split(eolRegex)[0] : null);
			});
		});
	}

	public addTag(repo: string, tagName: string, commitHash: string, lightweight: boolean, message: string) {
		let args = ['tag'];
		if (lightweight) {
			args.push(tagName);
		} else {
			args.push('-a', tagName, '-m', message);
		}
		args.push(commitHash);
		return this.runGitCommandSpawn(args, repo);
	}

	public deleteTag(repo: string, tagName: string) {
		return this.runGitCommand('tag -d ' + escapeRefName(tagName), repo);
	}

	public pushTag(repo: string, tagName: string) {
		return this.runGitCommand('push origin ' + escapeRefName(tagName), repo);
	}

	public createBranch(repo: string, branchName: string, commitHash: string) {
		return this.runGitCommand('branch ' + escapeRefName(branchName) + ' ' + commitHash, repo);
	}

	public checkoutBranch(repo: string, branchName: string, remoteBranch: string | null) {
		return this.runGitCommand('checkout ' + (remoteBranch === null ? escapeRefName(branchName) : ' -b ' + escapeRefName(branchName) + ' ' + escapeRefName(remoteBranch)), repo);
	}

	public checkoutCommit(repo: string, commitHash: string) {
		return this.runGitCommand('checkout ' + commitHash, repo);
	}

	public deleteBranch(repo: string, branchName: string, forceDelete: boolean) {
		return this.runGitCommand('branch --delete' + (forceDelete ? ' --force' : '') + ' ' + escapeRefName(branchName), repo);
	}

	public renameBranch(repo: string, oldName: string, newName: string) {
		return this.runGitCommand('branch -m ' + escapeRefName(oldName) + ' ' + escapeRefName(newName), repo);
	}

	public mergeBranch(repo: string, branchName: string, createNewCommit: boolean) {
		return this.runGitCommand('merge ' + escapeRefName(branchName) + (createNewCommit ? ' --no-ff' : ''), repo);
	}

	public mergeCommit(repo: string, commitHash: string, createNewCommit: boolean) {
		return this.runGitCommand('merge ' + commitHash + (createNewCommit ? ' --no-ff' : ''), repo);
	}

	public cherrypickCommit(repo: string, commitHash: string, parentIndex: number) {
		return this.runGitCommand('cherry-pick ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''), repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		return this.runGitCommand('revert --no-edit ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''), repo);
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		return this.runGitCommand('reset --' + resetMode + ' ' + commitHash, repo);
	}

	private getRefs(repo: string, showRemoteBranches: boolean) {
		return new Promise<GitRefData>((resolve) => {
			this.execGit('show-ref ' + (showRemoteBranches ? '' : '--heads --tags') + ' -d --head', repo, (err, stdout) => {
				let refData: GitRefData = { head: null, refs: [] };
				if (!err) {
					let lines = stdout.split(eolRegex);
					for (let i = 0; i < lines.length - 1; i++) {
						let line = lines[i].split(' ');
						if (line.length < 2) continue;

						let hash = line.shift()!;
						let ref = line.join(' ');

						if (ref.startsWith('refs/heads/')) {
							refData.refs.push({ hash: hash, name: ref.substring(11), type: 'head' });
						} else if (ref.startsWith('refs/tags/')) {
							refData.refs.push({ hash: hash, name: (ref.endsWith('^{}') ? ref.substring(10, ref.length - 3) : ref.substring(10)), type: 'tag' });
						} else if (ref.startsWith('refs/remotes/')) {
							refData.refs.push({ hash: hash, name: ref.substring(13), type: 'remote' });
						} else if (ref === 'HEAD') {
							refData.head = hash;
						}
					}
				}
				resolve(refData);
			});
		});
	}

	private getGitLog(repo: string, branch: string, num: number, showRemoteBranches: boolean) {
		let args = ['log', '--max-count=' + num, '--format=' + this.gitLogFormat, '--date-order'];
		if (branch !== '') {
			args.push(escapeRefName(branch));
		} else {
			args.push('--branches', '--tags');
			if (showRemoteBranches) args.push('--remotes');
		}

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(eolRegex);
			let gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(gitLogSeparator);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return gitCommits;
		}, []);
	}

	private getGitUnsavedChanges(repo: string) {
		return new Promise<GitUnsavedChanges | null>((resolve) => {
			this.execGit('status -s --branch --untracked-files --porcelain', repo, (err, stdout) => {
				if (!err) {
					let lines = stdout.split(eolRegex);
					resolve(lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null);
				} else {
					resolve(null);
				}
			});
		});
	}

	private runGitCommand(command: string, repo: string) {
		return new Promise<GitCommandStatus>((resolve) => {
			this.execGit(command, repo, (err, stdout, stderr) => {
				if (!err) {
					resolve(null);
				} else {
					let lines;
					if (stdout !== '' || stderr !== '') {
						lines = (stdout !== '' ? stdout : stderr !== '' ? stderr : '').split(eolRegex);
					} else {
						lines = err.message.split(eolRegex);
						lines.shift();
					}
					resolve(lines.slice(0, lines.length - 1).join('\n'));
				}
			});
		});
	}

	private runGitCommandSpawn(args: string[], repo: string) {
		return new Promise<GitCommandStatus>((resolve) => {
			let stdout = '', stderr = '', err = false;
			const cmd = cp.spawn(this.gitPath, args, { cwd: repo });
			cmd.stdout.on('data', d => { stdout += d; });
			cmd.stderr.on('data', d => { stderr += d; });
			cmd.on('error', e => {
				resolve(e.message.split(eolRegex).join('\n'));
				err = true;
			});
			cmd.on('exit', (code) => {
				if (err) return;
				if (code === 0) {
					resolve(null);
				} else {
					let lines = (stdout !== '' ? stdout : stderr !== '' ? stderr : '').split(eolRegex);
					resolve(lines.slice(0, lines.length - 1).join('\n'));
				}
			});
		});
	}

	private isGitRepository(folder: string) {
		return new Promise<boolean>((resolve) => {
			this.execGit('rev-parse --git-dir', folder, (err) => {
				resolve(!err);
			});
		});
	}

	private execGit(command: string, repo: string, callback: { (error: Error | null, stdout: string, stderr: string): void }) {
		cp.exec(this.gitExecPath + ' ' + command, { cwd: repo }, callback);
	}

	private spawnGit<T>(args: string[], repo: string, successValue: { (stdout: string): T }, errorValue: T) {
		return new Promise<T>((resolve) => {
			let stdout = '', err = false;
			const cmd = cp.spawn(this.gitPath, args, { cwd: repo });
			cmd.stdout.on('data', (d) => { stdout += d; });
			cmd.on('error', () => {
				resolve(errorValue);
				err = true;
			});
			cmd.on('exit', (code) => {
				if (err) return;
				resolve(code === 0 ? successValue(stdout) : errorValue);
			});
		});
	}
}

function escapeRefName(str: string) {
	return str.replace(/'/g, '\'');
}