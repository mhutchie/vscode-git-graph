import * as cp from 'child_process';
import { getConfig } from './config';
import { DiffSide, GitBranchData, GitCommandError, GitCommit, GitCommitComparisonData, GitCommitData, GitCommitDetails, GitCommitNode, GitFileChange, GitFileChangeType, GitRefData, GitResetMode, GitUnsavedChanges, RebaseOnType } from './types';
import { abbrevCommit, getPathFromStr, runCommandInNewTerminal, UNCOMMITTED } from './utils';

const eolRegex = /\r\n|\r|\n/g;
const headRegex = /^\(HEAD detached at [0-9A-Za-z]+\)/g;
const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export class DataSource {
	private gitPath!: string;
	private gitExecPath!: string;
	private gitLogFormat!: string;
	private gitCommitDetailsFormat!: string;

	constructor() {
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

	public getBranches(repo: string, showRemoteBranches: boolean) {
		return new Promise<GitBranchData>((resolve) => {
			this.execGit('branch' + (showRemoteBranches ? ' -a' : ''), repo, (err, stdout, stderr) => {
				let branchData: GitBranchData = { branches: [], head: null, error: null };

				if (err) {
					branchData.error = getErrorMessage(err, stdout, stderr);
				} else {
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

	public getCommits(repo: string, branches: string[] | null, maxCommits: number, showRemoteBranches: boolean) {
		return new Promise<GitCommitData>(resolve => {
			Promise.all([
				this.getGitLog(repo, branches, maxCommits + 1, showRemoteBranches),
				this.getRefs(repo, showRemoteBranches).then((refData: GitRefData) => refData, (errorMessage: string) => errorMessage),
				this.getRemotes(repo)
			]).then(async (results) => {
				let commits = results[0], refData = results[1], i, unsavedChanges = null;
				let moreCommitsAvailable = commits.length === maxCommits + 1;
				if (moreCommitsAvailable) commits.pop();

				// It doesn't matter if getRefs() was rejected if no commits exist
				if (typeof refData === 'string') {
					// getRefs() returned an error message (string)
					if (commits.length > 0) {
						// Commits exist, throw the error
						throw refData;
					} else {
						// No commits exist, so getRefs() will always return an error. Set refData to the default value
						refData = { head: null, heads: [], tags: [], remotes: [] };
					}
				}

				if (refData.head !== null) {
					for (i = 0; i < commits.length; i++) {
						if (refData.head === commits[i].hash) {
							unsavedChanges = getConfig().showUncommittedChanges() ? await this.getGitUnsavedChanges(repo) : null;
							if (unsavedChanges !== null) {
								commits.unshift({ hash: UNCOMMITTED, parentHashes: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
							}
							break;
						}
					}
				}

				let commitNodes: GitCommitNode[] = [];
				let commitLookup: { [hash: string]: number } = {};

				for (i = 0; i < commits.length; i++) {
					commitLookup[commits[i].hash] = i;
					commitNodes.push({ hash: commits[i].hash, parentHashes: commits[i].parentHashes, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, heads: [], tags: [], remotes: [] });
				}
				for (i = 0; i < refData.heads.length; i++) {
					if (typeof commitLookup[refData.heads[i].hash] === 'number') commitNodes[commitLookup[refData.heads[i].hash]].heads.push(refData.heads[i].name);
				}
				for (i = 0; i < refData.tags.length; i++) {
					if (typeof commitLookup[refData.tags[i].hash] === 'number') commitNodes[commitLookup[refData.tags[i].hash]].tags.push(refData.tags[i].name);
				}
				for (i = 0; i < refData.remotes.length; i++) {
					if (typeof commitLookup[refData.remotes[i].hash] === 'number') {
						let name = refData.remotes[i].name;
						let remote = results[2].find(remote => name.startsWith(remote + '/'));
						if (typeof remote === 'string') commitNodes[commitLookup[refData.remotes[i].hash]].remotes.push({ name: name, remote: remote });
					}
				}

				resolve({ commits: commitNodes, head: refData.head, remotes: results[2], moreCommitsAvailable: moreCommitsAvailable, error: null });
			}).catch((errorMessage) => {
				resolve({ commits: [], head: null, remotes: [], moreCommitsAvailable: false, error: errorMessage });
			});
		});
	}

	public commitDetails(repo: string, commitHash: string) {
		return new Promise<GitCommitDetails>(resolve => {
			Promise.all([
				new Promise<GitCommitDetails>((resolve, reject) => this.execGit('show --quiet ' + commitHash + ' --format="' + this.gitCommitDetailsFormat + '"', repo, (err, stdout, stderr) => {
					if (err) {
						reject(getErrorMessage(err, stdout, stderr));
					} else {
						let lines = stdout.split(eolRegex);
						let lastLine = lines.length - 1;
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
							fileChanges: [], error: null
						});
					}
				})),
				this.getDiffTreeNameStatus(repo, commitHash, commitHash),
				this.getDiffTreeNumStat(repo, commitHash, commitHash)
			]).then((results) => {
				results[0].fileChanges = generateFileChanges(results[1], results[2], []);
				resolve(results[0]);
			}).catch((errorMessage) => resolve({ hash: '', parents: [], author: '', email: '', date: 0, committer: '', body: '', fileChanges: [], error: errorMessage }));
		});
	}

	public uncommittedDetails(repo: string) {
		return new Promise<GitCommitDetails>(resolve => {
			let details: GitCommitDetails = { hash: UNCOMMITTED, parents: [], author: '', email: '', date: 0, committer: '', body: '', fileChanges: [], error: null };
			Promise.all([
				this.getDiffTreeNameStatus(repo, 'HEAD', ''),
				this.getDiffTreeNumStat(repo, 'HEAD', ''),
				this.getUntrackedFiles(repo)
			]).then((results) => {
				details.fileChanges = generateFileChanges(results[0], results[1], results[2]);
				resolve(details);
			}).catch((errorMessage) => {
				details.error = errorMessage;
				resolve(details);
			});
		});
	}

	public compareCommits(repo: string, fromHash: string, toHash: string) {
		return new Promise<GitCommitComparisonData>(resolve => {
			let promises = [
				this.getDiffTreeNameStatus(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
				this.getDiffTreeNumStat(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash)
			];
			if (toHash === UNCOMMITTED) promises.push(this.getUntrackedFiles(repo));

			Promise.all(promises)
				.then((results) => resolve({ fileChanges: generateFileChanges(results[0], results[1], toHash === UNCOMMITTED ? results[2] : []), error: null }))
				.catch((errorMessage) => resolve({ fileChanges: [], error: errorMessage }));
		});
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string, type: GitFileChangeType, diffSide: DiffSide) {
		return (commitHash === UNCOMMITTED && type === 'D') || (diffSide === 'old' && type === 'A') || (diffSide === 'new' && type === 'D')
			? new Promise<string>(resolve => resolve(''))
			: this.spawnGit(['show', commitHash + ':' + filePath], repo, stdout => stdout);
	}

	public async getRemoteUrl(repo: string) {
		return new Promise<string | null>(resolve => {
			this.execGit('config --get remote.origin.url', repo, (err, stdout) => {
				resolve(!err ? stdout.split(eolRegex)[0] : null);
			});
		});
	}

	public isGitRepository(path: string) {
		return new Promise<boolean>(resolve => {
			this.execGit('rev-parse --git-dir', path, (err) => {
				resolve(!err);
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

  public changeRemoteUrl(repo: string, remoteUrl: string, remoteName = 'origin') {
    return this.runGitCommand(`remote set-url ${remoteName} ${remoteUrl}`, repo)
  }

	public fetch(repo: string) {
		return this.runGitCommand('fetch --all', repo);
	}

	public pushBranch(repo: string, branchName: string, remote: string, setUpstream: boolean) {
		return this.runGitCommand('push' + (setUpstream ? ' -u' : '') + ' ' + escapeRefName(remote) + ' ' + escapeRefName(branchName), repo);
	}

	public pushTag(repo: string, tagName: string, remote: string) {
		return this.runGitCommand('push ' + escapeRefName(remote) + ' ' + escapeRefName(tagName), repo);
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

	public deleteRemoteBranch(repo: string, branchName: string, remote: string) {
		return this.runGitCommand('push ' + escapeRefName(remote) + ' --delete ' + escapeRefName(branchName), repo);
	}

	public renameBranch(repo: string, oldName: string, newName: string) {
		return this.runGitCommand('branch -m ' + escapeRefName(oldName) + ' ' + escapeRefName(newName), repo);
	}

	public async mergeBranch(repo: string, branchName: string, createNewCommit: boolean, squash: boolean) {
		let mergeStatus = await this.runGitCommand('merge ' + escapeRefName(branchName) + (createNewCommit && !squash ? ' --no-ff' : '') + (squash ? ' --squash' : ''), repo);
		if (mergeStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand('commit -m "Merge branch \'' + escapeRefName(branchName) + '\'"', repo);
			}
		}
		return mergeStatus;
	}

	public async mergeCommit(repo: string, commitHash: string, createNewCommit: boolean, squash: boolean) {
		let mergeStatus = await this.runGitCommand('merge ' + commitHash + (createNewCommit && !squash ? ' --no-ff' : '') + (squash ? ' --squash' : ''), repo);
		if (mergeStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand('commit -m "Merge commit \'' + commitHash + '\'"', repo);
			}
		}
		return mergeStatus;
	}

	public rebaseOn(repo: string, base: string, type: RebaseOnType, ignoreDate: boolean, interactive: boolean) {
		let escapedBase = type === 'Branch' ? escapeRefName(base) : base;
		if (interactive) {
			runCommandInNewTerminal(repo, this.gitExecPath + ' rebase --interactive ' + escapedBase, 'Git Rebase on "' + (type === 'Branch' ? base : abbrevCommit(base)) + '"');
			return new Promise<GitCommandError>(resolve => setTimeout(() => resolve(null), 1000));
		} else {
			return this.runGitCommand('rebase ' + escapedBase + (ignoreDate ? ' --ignore-date' : ''), repo);
		}
	}

	public cherrypickCommit(repo: string, commitHash: string, parentIndex: number) {
		return this.runGitCommand('cherry-pick ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''), repo);
	}

	public cleanUntrackedFiles(repo: string, directories: boolean) {
		return this.runGitCommand('clean -f' + (directories ? 'd' : ''), repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		return this.runGitCommand('revert --no-edit ' + commitHash + (parentIndex > 0 ? ' -m ' + parentIndex : ''), repo);
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		return this.runGitCommand('reset --' + resetMode + ' ' + commitHash, repo);
	}

	private getRefs(repo: string, showRemoteBranches: boolean) {
		let args = ['show-ref'];
		if (!showRemoteBranches) args.push('--heads', '--tags');
		args.push('-d', '--head');

		return this.spawnGit(args, repo, (stdout) => {
			let refData: GitRefData = { head: null, heads: [], tags: [], remotes: [] };
			let lines = stdout.split(eolRegex);
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(' ');
				if (line.length < 2) continue;

				let hash = line.shift()!;
				let ref = line.join(' ');

				if (ref.startsWith('refs/heads/')) {
					refData.heads.push({ hash: hash, name: ref.substring(11) });
				} else if (ref.startsWith('refs/tags/')) {
					refData.tags.push({ hash: hash, name: (ref.endsWith('^{}') ? ref.substring(10, ref.length - 3) : ref.substring(10)) });
				} else if (ref.startsWith('refs/remotes/')) {
					refData.remotes.push({ hash: hash, name: ref.substring(13) });
				} else if (ref === 'HEAD') {
					refData.head = hash;
				}
			}
			return refData;
		});
	}

	private getRemotes(repo: string) {
		return new Promise<string[]>((resolve, reject) => {
			this.execGit('remote', repo, (err, stdout, stderr) => {
				if (err) {
					reject(getErrorMessage(err, stdout, stderr));
				} else {
					let lines = stdout.split(eolRegex);
					lines.pop();
					resolve(lines);
				}
			});
		});
	}

	private getGitLog(repo: string, branches: string[] | null, num: number, showRemoteBranches: boolean) {
		let args = ['log', '--max-count=' + num, '--format=' + this.gitLogFormat, '--date-order'];
		if (branches !== null) {
			for (let i = 0; i < branches.length; i++) {
				args.push(escapeRefName(branches[i]));
			}
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
		});
	}

	private getGitUnsavedChanges(repo: string) {
		return new Promise<GitUnsavedChanges | null>((resolve, reject) => {
			this.execGit('status -s --branch --untracked-files --porcelain', repo, (err, stdout, stderr) => {
				if (err) {
					reject(getErrorMessage(err, stdout, stderr));
				} else {
					let lines = stdout.split(eolRegex);
					resolve(lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null);
				}
			});
		});
	}

	private getUntrackedFiles(repo: string) {
		return new Promise<string[]>((resolve, reject) => {
			this.execGit('-c core.quotepath=false status -s --untracked-files --porcelain', repo, (err, stdout, stderr) => {
				if (err) {
					reject(getErrorMessage(err, stdout, stderr));
				} else {
					let files = [], lines = stdout.split(eolRegex);
					for (let i = 0; i < lines.length; i++) {
						if (lines[i].startsWith('??')) files.push(lines[i].substr(3));
					}
					resolve(files);
				}
			});
		});
	}

	private getDiffTreeNameStatus(repo: string, fromHash: string, toHash: string) {
		let cmd = fromHash === toHash
			? 'diff-tree --name-status -r -m --root --find-renames --diff-filter=AMDR ' + fromHash
			: 'diff --name-status -m --find-renames --diff-filter=AMDR ' + fromHash + (toHash !== '' ? ' ' + toHash : '');
		return this.execDiffTree(repo, cmd, fromHash, toHash);
	}
	private getDiffTreeNumStat(repo: string, fromHash: string, toHash: string) {
		let cmd = fromHash === toHash
			? 'diff-tree --numstat -r -m --root --find-renames --diff-filter=AMDR ' + fromHash
			: 'diff --numstat -m --find-renames --diff-filter=AMDR ' + fromHash + (toHash !== '' ? ' ' + toHash : '');
		return this.execDiffTree(repo, cmd, fromHash, toHash);
	}
	private execDiffTree(repo: string, cmd: string, fromHash: string, toHash: string) {
		return new Promise<string[]>((resolve, reject) => this.execGit('-c core.quotepath=false ' + cmd, repo, (err, stdout, stderr) => {
			if (err) {
				reject(getErrorMessage(err, stdout, stderr));
			} else {
				let lines = stdout.split(eolRegex);
				if (fromHash === toHash) lines.shift();
				resolve(lines);
			}
		}));
	}

	private areStagedChanges(repo: string) {
		return new Promise<boolean>(resolve => {
			this.execGit('diff-index HEAD', repo, (err, stdout) => resolve(!err && stdout !== ''));
		});
	}

	private runGitCommand(command: string, repo: string) {
		return new Promise<GitCommandError>((resolve) => {
			this.execGit(command, repo, (err, stdout, stderr) => {
				resolve(err ? getErrorMessage(err, stdout, stderr) : null);
			});
		});
	}

	private runGitCommandSpawn(args: string[], repo: string) {
		return new Promise<GitCommandError>((resolve) => {
			let stdout = '', stderr = '', err = false;
			const cmd = cp.spawn(this.gitPath, args, { cwd: repo });
			cmd.stdout.on('data', (d) => { stdout += d; });
			cmd.stderr.on('data', (d) => { stderr += d; });
			cmd.on('error', (e) => {
				resolve(getErrorMessage(e, stdout, stderr));
				err = true;
			});
			cmd.on('exit', (code) => {
				if (err) return;
				resolve(code === 0 ? null : getErrorMessage(null, stdout, stderr));
			});
		});
	}

	private execGit(command: string, repo: string, callback: { (error: Error | null, stdout: string, stderr: string): void }) {
		cp.exec(this.gitExecPath + ' ' + command, { cwd: repo }, callback);
	}

	private spawnGit<T>(args: string[], repo: string, successValue: { (stdout: string): T }) {
		return new Promise<T>((resolve, reject) => {
			let stdout = '', stderr = '', err = false;
			const cmd = cp.spawn(this.gitPath, args, { cwd: repo });
			cmd.stdout.on('data', (d) => { stdout += d; });
			cmd.stderr.on('data', (d) => { stderr += d; });
			cmd.on('error', (e) => {
				reject(getErrorMessage(e, stdout, stderr));
				err = true;
			});
			cmd.on('exit', (code) => {
				if (err) return;
				if (code === 0) {
					resolve(successValue(stdout));
				} else {
					reject(getErrorMessage(null, stdout, stderr));
				}
			});
		});
	}
}

function escapeRefName(str: string) {
	return str.replace(/'/g, '\'');
}

// Generates a list of file changes from each diff-tree output
function generateFileChanges(nameStatusResults: string[], numStatResults: string[], unstagedFiles: string[]) {
	let fileChanges: GitFileChange[] = [], fileLookup: { [file: string]: number } = {}, i = 0;

	for (i = 0; i < nameStatusResults.length - 1; i++) {
		let line = nameStatusResults[i].split('\t');
		if (line.length < 2) continue;
		let oldFilePath = getPathFromStr(line[1]), newFilePath = getPathFromStr(line[line.length - 1]);
		fileLookup[newFilePath] = fileChanges.length;
		fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
	}

	for (i = 0; i < unstagedFiles.length; i++) {
		fileChanges.push({ oldFilePath: unstagedFiles[i], newFilePath: unstagedFiles[i], type: 'U', additions: null, deletions: null });
	}

	for (i = 0; i < numStatResults.length - 1; i++) {
		let line = numStatResults[i].split('\t');
		if (line.length !== 3) continue;
		let fileName = line[2].replace(/(.*){.* => (.*)}/, '$1$2').replace(/.* => (.*)/, '$1');
		if (typeof fileLookup[fileName] === 'number') {
			fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
			fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
		}
	}

	return fileChanges;
}

function getErrorMessage(error: Error | null, stdout: string, stderr: string) {
	let lines: string[];
	if (stdout !== '' || stderr !== '') {
		lines = (stderr !== '' ? stderr : stdout !== '' ? stdout : '').split(eolRegex);
		lines.pop();
	} else if (error) {
		lines = error.message.split(eolRegex);
	} else {
		lines = [];
	}
	return lines.join('\n');
}