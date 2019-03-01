import * as cp from 'child_process';
import { Config } from './config';
import { GitCommandStatus, GitCommit, GitCommitDetails, GitCommitNode, GitFileChangeType, GitRefData, GitResetMode, GitUnsavedChanges } from './types';

const eolRegex = /\r\n|\r|\n/g;
const headRegex = /^\(HEAD detached at [0-9A-Za-z]+\)/g;

const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';
const gitLogFormat = ['%H', '%P', '%an', '%ae', '%at', '%s'].join(gitLogSeparator);
const gitCommitDetailsFormat = ['%H', '%P', '%an', '%ae', '%at', '%cn', '%B'].join(gitLogSeparator);

export class DataSource {
	private execOptions: cp.ExecOptions;
	private gitPath!: string;
	private gitExecPath!: string;

	constructor(workspaceDir: string) {
		this.execOptions = { cwd: workspaceDir };
		this.registerGitPath();
	}

	public registerGitPath() {
		this.gitPath = (new Config()).gitPath();
		this.gitExecPath = this.gitPath.indexOf(' ') > -1 ? '"' + this.gitPath + '"' : this.gitPath;
	}

	public isGitRepository() {
		return new Promise<boolean>((resolve) => {
			this.execGit('rev-parse --git-dir', (err) => {
				resolve(!err);
			});
		});
	}

	public getBranches(showRemoteBranches: boolean) {
		return new Promise<string[]>((resolve) => {
			this.execGit('branch' + (showRemoteBranches ? ' -a' : ''), (err, stdout) => {
				if (!err) {
					let lines = stdout.split(eolRegex);
					let branches: string[] = [];
					for (let i = 0; i < lines.length - 1; i++) {
						let name = lines[i].substring(2).split(' -> ')[0];
						if (name.match(headRegex) !== null) continue;

						if (lines[i][0] === '*') {
							branches.unshift(name);
						} else {
							branches.push(name);
						}
					}
					resolve(branches);
				} else {
					resolve([]);
				}
			});
		});
	}

	public async getCommits(branch: string, maxCommits: number, showRemoteBranches: boolean) {
		let commits = await this.getGitLog(branch, maxCommits + 1, showRemoteBranches);
		let refData = await this.getRefs(showRemoteBranches);
		let i, unsavedChanges = null;

		let moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

		if (refData.head !== null) {
			for (i = 0; i < commits.length; i++) {
				if (refData.head === commits[i].hash) {
					unsavedChanges = (new Config()).showUncommittedChanges() ? await this.getGitUnsavedChanges() : null;
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
			commitNodes.push({ hash: commits[i].hash, parentHashes: commits[i].parentHashes, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: [], current: false });
		}
		for (i = 0; i < refData.refs.length; i++) {
			if (typeof commitLookup[refData.refs[i].hash] === 'number') {
				commitNodes[commitLookup[refData.refs[i].hash]].refs.push(refData.refs[i]);
			}
		}

		if (unsavedChanges !== null) {
			commitNodes[0].current = true;
		} else if (refData.head !== null && typeof commitLookup[refData.head] === 'number') {
			commitNodes[commitLookup[refData.head]].current = true;
		}

		return { commits: commitNodes, moreCommitsAvailable: moreCommitsAvailable };
	}

	public async commitDetails(commitHash: string) {
		try {
			let details = await new Promise<GitCommitDetails>((resolve, reject) => {
				this.execGit('show --quiet ' + commitHash + ' --format="' + gitCommitDetailsFormat + '"', (err, stdout) => {
					if (!err) {
						let lines = stdout.split(eolRegex);
						let commitInfo = lines[0].split(gitLogSeparator);
						resolve({
							hash: commitInfo[0],
							parents: commitInfo[1].split(' '),
							author: commitInfo[2],
							email: commitInfo[3],
							date: parseInt(commitInfo[4]),
							committer: commitInfo[5],
							body: commitInfo[6],
							fileChanges: []
						});
					} else {
						reject();
					}
				});
			});
			let fileLookup: { [file: string]: number } = {};
			await new Promise((resolve, reject) => {
				this.execGit('diff-tree --name-status -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, (err, stdout) => {
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
				this.execGit('diff-tree --numstat -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, (err, stdout) => {
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

	public getCommitFile(commitHash: string, filePath: string) {
		return this.spawnGit(['show', commitHash + ':' + filePath], stdout => stdout, '');
	}

	public addTag(tagName: string, commitHash: string) {
		return this.runGitCommand('tag -a ' + escapeRefName(tagName) + ' -m "" ' + commitHash);
	}

	public deleteTag(tagName: string) {
		return this.runGitCommand('tag -d ' + escapeRefName(tagName));
	}

	public createBranch(branchName: string, commitHash: string) {
		return this.runGitCommand('branch ' + escapeRefName(branchName) + ' ' + commitHash);
	}

	public checkoutBranch(branchName: string, remoteBranch: string | null) {
		return this.runGitCommand('checkout ' + (remoteBranch === null ? escapeRefName(branchName) : ' -b ' + escapeRefName(branchName) + ' ' + escapeRefName(remoteBranch)));
	}

	public deleteBranch(branchName: string, forceDelete: boolean) {
		return this.runGitCommand('branch --delete' + (forceDelete ? ' --force' : '') + ' ' + escapeRefName(branchName));
	}

	public renameBranch(oldName: string, newName: string) {
		return this.runGitCommand('branch -m ' + escapeRefName(oldName) + ' ' + escapeRefName(newName));
	}

	public mergeBranch(branchName: string) {
		return this.runGitCommand('merge ' + escapeRefName(branchName));
	}

	public cherrypickCommit(commitHash: string, parentIndex: number) {
		return this.runGitCommand('cherry-pick ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''));
	}

	public revertCommit(commitHash: string, parentIndex: number) {
		return this.runGitCommand('revert --no-edit ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''));
	}

	public resetToCommit(commitHash: string, resetMode: GitResetMode) {
		return this.runGitCommand('reset --' + resetMode + ' ' + commitHash);
	}

	private getRefs(showRemoteBranches: boolean) {
		return new Promise<GitRefData>((resolve) => {
			this.execGit('show-ref ' + (showRemoteBranches ? '' : '--heads --tags') + ' -d --head', (err, stdout) => {
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

	private getGitLog(branch: string, num: number, showRemoteBranches: boolean) {
		let args = ['log', '--max-count=' + num, '--format=' + gitLogFormat, '--date-order'];
		if (branch !== '') {
			args.push(escapeRefName(branch));
		} else {
			args.push('--branches');
			if (showRemoteBranches) args.push('--remotes');
		}

		return this.spawnGit(args, (stdout) => {
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

	private getGitUnsavedChanges() {
		return new Promise<GitUnsavedChanges | null>((resolve) => {
			this.execGit('status -s --branch --untracked-files --porcelain', (err, stdout) => {
				if (!err) {
					let lines = stdout.split(eolRegex);
					resolve(lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null);
				} else {
					resolve(null);
				}
			});
		});
	}

	private runGitCommand(command: string) {
		return new Promise<GitCommandStatus>((resolve) => {
			this.execGit(command, (err) => {
				if (!err) {
					resolve(null);
				} else {
					let lines = err.message.split(eolRegex);
					resolve(lines.slice(1, lines.length - 1).join('\n'));
				}
			});
		});
	}

	private execGit(command: string, callback: { (error: Error | null, stdout: string, stderr: string): void }) {
		cp.exec(this.gitExecPath + ' ' + command, this.execOptions, callback);
	}

	private spawnGit<T>(args: string[], successValue: { (stdout: string): T }, errorValue: T) {
		return new Promise<T>((resolve) => {
			let stdout = '', err = false;
			const cmd = cp.spawn(this.gitPath, args, this.execOptions);
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