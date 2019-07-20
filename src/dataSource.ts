import * as cp from 'child_process';
import { AskpassEnvironment, AskpassManager } from './askpass/askpassManager';
import { getConfig } from './config';
import { Logger } from './logger';
import { CommitOrdering, DiffSide, GitBranchData, GitCommandError, GitCommit, GitCommitComparisonData, GitCommitData, GitCommitDetails, GitCommitNode, GitFileChange, GitFileChangeType, GitRefData, GitRepoSettingsData, GitResetMode, GitUnsavedChanges, RebaseOnType } from './types';
import { abbrevCommit, getPathFromStr, GitExecutable, runGitCommandInNewTerminal, UNABLE_TO_FIND_GIT_MSG, UNCOMMITTED } from './utils';

const EOL_REGEX = /\r\n|\r|\n/g;
const INVALID_BRANCH_REGEX = /^\(.* .*\)$/;
const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export class DataSource {
	private readonly logger: Logger;
	private gitExecutable: GitExecutable | null;
	private gitLogFormat!: string;
	private gitCommitDetailsFormat!: string;
	private askpassManager: AskpassManager;
	private askpassEnv: AskpassEnvironment;

	constructor(gitExecutable: GitExecutable | null, logger: Logger) {
		this.gitExecutable = gitExecutable;
		this.logger = logger;
		this.generateGitCommandFormats();
		this.askpassManager = new AskpassManager();
		this.askpassEnv = this.askpassManager.getEnv();
	}

	public isGitExecutableUnknown() {
		return this.gitExecutable === null;
	}

	public setGitExecutable(gitExecutable: GitExecutable) {
		this.gitExecutable = gitExecutable;
	}

	public generateGitCommandFormats() {
		let dateType = getConfig().dateType() === 'Author Date' ? '%at' : '%ct';
		this.gitLogFormat = ['%H', '%P', '%an', '%ae', dateType, '%s'].join(GIT_LOG_SEPARATOR);
		this.gitCommitDetailsFormat = ['%H', '%P', '%an', '%ae', dateType, '%cn'].join(GIT_LOG_SEPARATOR) + '%n%B';
	}

	public dispose() {
		this.askpassManager.dispose();
	}

	public getBranches(repo: string, showRemoteBranches: boolean) {
		return new Promise<GitBranchData>((resolve) => {
			let args = ['branch'];
			if (showRemoteBranches) args.push('-a');

			this.spawnGit(args, repo, (stdout) => {
				let branchData: GitBranchData = { branches: [], head: null, error: null };
				let lines = stdout.split(EOL_REGEX);
				for (let i = 0; i < lines.length - 1; i++) {
					let name = lines[i].substring(2).split(' -> ')[0];
					if (INVALID_BRANCH_REGEX.test(name)) continue;

					if (lines[i][0] === '*') {
						branchData.head = name;
						branchData.branches.unshift(name);
					} else {
						branchData.branches.push(name);
					}
				}
				return branchData;
			}).then((data) => {
				resolve(data);
			}).catch((errorMessage) => {
				resolve({ branches: [], head: null, error: errorMessage });
			});
		});
	}

	public getCommits(repo: string, branches: string[] | null, maxCommits: number, showRemoteBranches: boolean) {
		const config = getConfig();
		return new Promise<GitCommitData>(resolve => {
			Promise.all([
				this.getGitLog(repo, branches, maxCommits + 1, showRemoteBranches, config.commitOrdering()),
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
							unsavedChanges = config.showUncommittedChanges() ? await this.getGitUnsavedChanges(repo) : null;
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
						commitNodes[commitLookup[refData.remotes[i].hash]].remotes.push({ name: name, remote: remote ? remote : null });
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
				this.spawnGit(['show', '--quiet', commitHash, '--format=' + this.gitCommitDetailsFormat], repo, (stdout): GitCommitDetails => {
					let lines = stdout.split(EOL_REGEX);
					let lastLine = lines.length - 1;
					while (lines.length > 0 && lines[lastLine] === '') lastLine--;
					let commitInfo = lines[0].split(GIT_LOG_SEPARATOR);
					return {
						hash: commitInfo[0],
						parents: commitInfo[1].split(' '),
						author: commitInfo[2],
						email: commitInfo[3],
						date: parseInt(commitInfo[4]),
						committer: commitInfo[5],
						body: lines.slice(1, lastLine + 1).join('\n'),
						fileChanges: [], error: null
					};
				}),
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

	public async getRepoSettings(repo: string) {
		return new Promise<GitRepoSettingsData>(resolve => {
			Promise.all([
				this.getConfigList(repo, 'local'),
				this.getRemotes(repo)
			]).then((results) => {
				let configNames: string[] = [];
				results[1].forEach(remote => {
					configNames.push('remote.' + remote + '.url', 'remote.' + remote + '.pushurl');
				});
				let configs = getConfigs(results[0], configNames);
				resolve({
					settings: {
						remotes: results[1].map(remote => ({
							name: remote,
							url: configs['remote.' + remote + '.url'],
							pushUrl: configs['remote.' + remote + '.pushurl']
						}))
					},
					error: null
				});
			}).catch((errorMessage) => {
				resolve({ settings: null, error: errorMessage });
			});
		});
	}

	public async getRemoteUrl(repo: string, remote: string) {
		return new Promise<string | null>(resolve => {
			this.spawnGit(['config', '--get', 'remote.' + remote + '.url'], repo, stdout => stdout.split(EOL_REGEX)[0])
				.then(value => resolve(value))
				.catch(() => resolve(null));
		});
	}

	public isGitRepository(path: string) {
		return this.spawnGit(['rev-parse', '--git-dir'], path, (stdout) => stdout).then(() => true, () => false);
	}

	public async addRemote(repo: string, name: string, url: string, pushUrl: string | null, fetch: boolean) {
		let status = await this.runGitCommand(['remote', 'add', name, url], repo);
		if (status !== null) return status;

		if (pushUrl !== null) {
			status = await this.runGitCommand(['remote', 'set-url', name, '--push', pushUrl], repo);
			if (status !== null) return status;
		}

		return fetch ? this.fetch(repo, name) : null;
	}

	public async editRemote(repo: string, nameOld: string, nameNew: string, urlOld: string | null, urlNew: string | null, pushUrlOld: string | null, pushUrlNew: string | null) {
		if (nameOld !== nameNew) {
			let status = await this.runGitCommand(['remote', 'rename', nameOld, nameNew], repo);
			if (status !== null) return status;
		}

		if (urlOld !== urlNew) {
			let args = ['remote', 'set-url', nameNew];
			if (urlNew === null) args.push('--delete', urlOld!);
			else if (urlOld === null) args.push('--add', urlNew);
			else args.push(urlNew, urlOld);

			let status = await this.runGitCommand(args, repo);
			if (status !== null) return status;
		}

		if (pushUrlOld !== pushUrlNew) {
			let args = ['remote', 'set-url', '--push', nameNew];
			if (pushUrlNew === null) args.push('--delete', pushUrlOld!);
			else if (pushUrlOld === null) args.push('--add', pushUrlNew);
			else args.push(pushUrlNew, pushUrlOld);

			let status = await this.runGitCommand(args, repo);
			if (status !== null) return status;
		}

		return null;
	}

	public deleteRemote(repo: string, name: string) {
		return this.runGitCommand(['remote', 'remove', name], repo);
	}

	public addTag(repo: string, tagName: string, commitHash: string, lightweight: boolean, message: string) {
		let args = ['tag'];
		if (lightweight) {
			args.push(tagName);
		} else {
			args.push('-a', tagName, '-m', message);
		}
		args.push(commitHash);
		return this.runGitCommand(args, repo);
	}

	public async deleteTag(repo: string, tagName: string, deleteOnRemote: string | null) {
		if (deleteOnRemote !== null) {
			let status = await this.runGitCommand(['push', deleteOnRemote, '--delete', tagName], repo);
			if (status !== null) return status;
		}
		return this.runGitCommand(['tag', '-d', tagName], repo);
	}

	public fetch(repo: string, remote: string | null) {
		return this.runGitCommand(['fetch', remote === null ? '--all' : remote], repo);
	}

	public pushBranch(repo: string, branchName: string, remote: string, setUpstream: boolean) {
		let args = ['push'];
		if (setUpstream) args.push('-u');
		args.push(remote, branchName);

		return this.runGitCommand(args, repo);
	}

	public pushTag(repo: string, tagName: string, remote: string) {
		return this.runGitCommand(['push', remote, tagName], repo);
	}

	public createBranch(repo: string, branchName: string, commitHash: string, checkout: boolean) {
		let args = [];
		if (checkout) args.push('checkout', '-b');
		else args.push('branch');
		args.push(branchName, commitHash);

		return this.runGitCommand(args, repo);
	}

	public checkoutBranch(repo: string, branchName: string, remoteBranch: string | null) {
		let args = ['checkout'];
		if (remoteBranch === null) args.push(branchName);
		else args.push('-b', branchName, remoteBranch);

		return this.runGitCommand(args, repo);
	}

	public checkoutCommit(repo: string, commitHash: string) {
		return this.runGitCommand(['checkout', commitHash], repo);
	}

	public deleteBranch(repo: string, branchName: string, forceDelete: boolean) {
		let args = ['branch', '--delete'];
		if (forceDelete) args.push('--force');
		args.push(branchName);

		return this.runGitCommand(args, repo);
	}

	public async deleteRemoteBranch(repo: string, branchName: string, remote: string) {
		let remoteStatus = await this.runGitCommand(['push', remote, '--delete', branchName], repo);
		if (remoteStatus !== null && (new RegExp('remote ref does not exist', 'i')).test(remoteStatus)) {
			let trackingBranchStatus = await this.runGitCommand(['branch', '-d', '-r', remote + '/' + branchName], repo);
			return trackingBranchStatus === null ? null : 'Branch does not exist on the remote, deleting the remote tracking branch ' + remote + '/' + branchName + '.\n' + trackingBranchStatus;
		}
		return remoteStatus;
	}

	public renameBranch(repo: string, oldName: string, newName: string) {
		return this.runGitCommand(['branch', '-m', oldName, newName], repo);
	}

	public async mergeBranch(repo: string, branchName: string, createNewCommit: boolean, squash: boolean) {
		let args = ['merge', branchName];
		if (squash) args.push('--squash');
		else if (createNewCommit) args.push('--no-ff');

		let mergeStatus = await this.runGitCommand(args, repo);
		if (mergeStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand(['commit', '-m', 'Merge branch \'' + branchName + '\''], repo);
			}
		}
		return mergeStatus;
	}

	public async mergeCommit(repo: string, commitHash: string, createNewCommit: boolean, squash: boolean) {
		let args = ['merge', commitHash];
		if (squash) args.push('--squash');
		else if (createNewCommit) args.push('--no-ff');

		let mergeStatus = await this.runGitCommand(args, repo);
		if (mergeStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand(['commit', '-m', 'Merge commit \'' + commitHash + '\''], repo);
			}
		}
		return mergeStatus;
	}

	public async pullBranch(repo: string, branchName: string, remote: string, createNewCommit: boolean, squash: boolean) {
		let args = ['pull', remote, branchName];
		if (squash) args.push('--squash');
		else if (createNewCommit) args.push('--no-ff');

		let pullStatus = await this.runGitCommand(args, repo);
		if (pullStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand(['commit', '-m', 'Merge branch \'' + remote + '/' + branchName + '\''], repo);
			}
		}
		return pullStatus;
	}

	public rebaseOn(repo: string, base: string, type: RebaseOnType, ignoreDate: boolean, interactive: boolean) {
		if (interactive) {
			return new Promise<GitCommandError>(resolve => {
				if (this.gitExecutable === null) return resolve(UNABLE_TO_FIND_GIT_MSG);

				runGitCommandInNewTerminal(repo, this.gitExecutable, 
					'rebase --interactive ' + (type === 'Branch' ? base.replace(/'/g, '"\'"') : base),
					'Git Rebase on "' + (type === 'Branch' ? base : abbrevCommit(base)) + '"');
				setTimeout(() => resolve(null), 1000);
			});
		} else {
			let args = ['rebase', base];
			if (ignoreDate) args.push('--ignore-date');
			return this.runGitCommand(args, repo);
		}
	}

	public cherrypickCommit(repo: string, commitHash: string, parentIndex: number) {
		let args = ['cherry-pick', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}

	public cleanUntrackedFiles(repo: string, directories: boolean) {
		return this.runGitCommand(['clean', '-f' + (directories ? 'd' : '')], repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		let args = ['revert', '--no-edit', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		return this.runGitCommand(['reset', '--' + resetMode, commitHash], repo);
	}

	private getRefs(repo: string, showRemoteBranches: boolean) {
		let args = ['show-ref'];
		if (!showRemoteBranches) args.push('--heads', '--tags');
		args.push('-d', '--head');

		return this.spawnGit(args, repo, (stdout) => {
			let refData: GitRefData = { head: null, heads: [], tags: [], remotes: [] };
			let lines = stdout.split(EOL_REGEX);
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
		return this.spawnGit(['remote'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			lines.pop();
			return lines;
		});
	}

	private async getConfigList(repo: string, type: 'local' | 'global' | 'system') {
		return this.spawnGit(['--no-pager', 'config', '--list', '--' + type], repo, (stdout) => stdout.split(EOL_REGEX));
	}

	private getGitLog(repo: string, branches: string[] | null, num: number, showRemoteBranches: boolean, order: CommitOrdering) {
		let args = ['log', '--max-count=' + num, '--format=' + this.gitLogFormat, '--' + order + '-order'];
		if (branches !== null) {
			for (let i = 0; i < branches.length; i++) {
				args.push(branches[i]);
			}
		} else {
			// Show All
			args.push('--branches', '--tags');
			if (showRemoteBranches) args.push('--remotes');
			args.push('HEAD');
		}

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			let gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(GIT_LOG_SEPARATOR);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return gitCommits;
		});
	}

	private getGitUnsavedChanges(repo: string) {
		return this.spawnGit<GitUnsavedChanges | null>(['status', '-s', '--branch', '--untracked-files', '--porcelain'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			return lines.length > 2
				? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 }
				: null;
		});
	}

	private getUntrackedFiles(repo: string) {
		return this.spawnGit(['-c', 'core.quotepath=false', 'status', '-s', '--untracked-files', '--porcelain'], repo, (stdout) => {
			let files = [], lines = stdout.split(EOL_REGEX);
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].startsWith('??')) files.push(lines[i].substr(3));
			}
			return files;
		});
	}

	private getDiffTreeNameStatus(repo: string, fromHash: string, toHash: string) {
		let args = ['-c', 'core.quotepath=false'];
		if (fromHash === toHash) {
			args.push('diff-tree', '--name-status', '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', fromHash);
		} else {
			args.push('diff', '--name-status', '-m', '--find-renames', '--diff-filter=AMDR', fromHash);
			if (toHash !== '') args.push(toHash);
		}
		return this.execDiffTree(repo, args, fromHash, toHash);
	}
	private getDiffTreeNumStat(repo: string, fromHash: string, toHash: string) {
		let args = ['-c', 'core.quotepath=false'];
		if (fromHash === toHash) {
			args.push('diff-tree', '--numstat', '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', fromHash);
		} else {
			args.push('diff', '--numstat', '-m', '--find-renames', '--diff-filter=AMDR', fromHash);
			if (toHash !== '') args.push(toHash);
		}
		return this.execDiffTree(repo, args, fromHash, toHash);
	}
	private execDiffTree(repo: string, args: string[], fromHash: string, toHash: string) {
		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			if (fromHash === toHash) lines.shift();
			return lines;
		});
	}

	private areStagedChanges(repo: string) {
		return this.spawnGit(['diff-index', 'HEAD'], repo, (stdout) => stdout !== '').then(changes => changes, () => false);
	}

	private runGitCommand(args: string[], repo: string) {
		return new Promise<GitCommandError>((resolve) => {
			if (this.gitExecutable === null) return resolve(UNABLE_TO_FIND_GIT_MSG);

			let stdout = '', stderr = '', err = false;
			const cmd = cp.spawn(this.gitExecutable.path, args, { cwd: repo, env: this.getEnv() });
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
			this.logger.logCmd('git', args);
		});
	}

	private spawnGit<T>(args: string[], repo: string, successValue: { (stdout: string): T }) {
		return new Promise<T>((resolve, reject) => {
			if (this.gitExecutable === null) return reject(UNABLE_TO_FIND_GIT_MSG);

			let stdout = '', stderr = '', err = false;
			const cmd = cp.spawn(this.gitExecutable.path, args, { cwd: repo, env: this.getEnv() });
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
			this.logger.logCmd('git', args);
		});
	}

	private getEnv() {
		return Object.assign({}, process.env, this.askpassEnv);
	}
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

// Get the specified config values from a git config list
function getConfigs(configList: string[], configNames: string[]) {
	let results: { [configName: string]: string | null } = {}, matchConfigs: string[] = [];
	configNames.forEach(configName => {
		results[configName] = null;
		matchConfigs.push(configName + '=');
	});
	for (let i = 0; i < configList.length; i++) {
		for (let j = 0; j < configNames.length; j++) {
			if (configList[i].startsWith(matchConfigs[j])) {
				results[configNames[j]] = configList[i].substring(configNames[j].length + 1);
				break;
			}
		}
	}
	return results;
}

function getErrorMessage(error: Error | null, stdout: string, stderr: string) {
	let lines: string[];
	if (stdout !== '' || stderr !== '') {
		lines = (stderr + stdout).split(EOL_REGEX);
		lines.pop();
	} else if (error) {
		lines = error.message.split(EOL_REGEX);
	} else {
		lines = [];
	}
	return lines.join('\n');
}