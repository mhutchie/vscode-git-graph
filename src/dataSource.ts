import * as cp from 'child_process';
import * as fs from 'fs';
import { decode, encodingExists } from 'iconv-lite';
import * as path from 'path';
import { Uri } from 'vscode';
import { AskpassEnvironment, AskpassManager } from './askpass/askpassManager';
import { getConfig } from './config';
import { Logger } from './logger';
import { BranchOrCommit, CommitOrdering, DateType, ErrorInfo, GitBranchData, GitCommit, GitCommitComparisonData, GitCommitData, GitCommitDetails, GitCommitNode, GitFileChange, GitFileChangeType, GitRefData, GitRepoSettingsData, GitResetMode, GitStash, GitTagDetailsData, GitUnsavedChanges } from './types';
import { abbrevCommit, compareVersions, constructIncompatibleGitVersionMessage, getPathFromStr, getPathFromUri, GitExecutable, realpath, runGitCommandInNewTerminal, UNABLE_TO_FIND_GIT_MSG, UNCOMMITTED } from './utils';

const EOL_REGEX = /\r\n|\r|\n/g;
const INVALID_BRANCH_REGEX = /^\(.* .*\)$/;
const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export class DataSource {
	private readonly logger: Logger;
	private readonly askpassManager: AskpassManager;
	private readonly askpassEnv: AskpassEnvironment;

	private gitExecutable: GitExecutable | null;
	private gitFormatCommitDetails!: string;
	private gitFormatLog!: string;
	private gitFormatStash!: string;

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
		const config = getConfig();
		let dateType = config.dateType() === DateType.Author ? '%at' : '%ct';
		let useMailmap = config.useMailmap();
		this.gitFormatCommitDetails = ['%H', '%P', useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, useMailmap ? '%cN' : '%cn'].join(GIT_LOG_SEPARATOR) + '%n%B';
		this.gitFormatLog = ['%H', '%P', useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, '%s'].join(GIT_LOG_SEPARATOR);
		this.gitFormatStash = ['%H', '%P', '%gD', useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, '%s'].join(GIT_LOG_SEPARATOR);
	}

	public dispose() {
		this.askpassManager.dispose();
	}


	/* Get Data Methods - Core */

	public getBranches(repo: string, showRemoteBranches: boolean) {
		return new Promise<GitBranchData>((resolve) => {
			let args = ['branch'];
			if (showRemoteBranches) args.push('-a');
			args.push('--no-color');

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
				this.getLog(repo, branches, maxCommits + 1, config.showCommitsOnlyReferencedByTags(), showRemoteBranches, config.commitOrdering()),
				this.getRefs(repo, showRemoteBranches).then((refData: GitRefData) => refData, (errorMessage: string) => errorMessage),
				this.getStashes(repo),
				this.getRemotes(repo)
			]).then(async (results) => {
				let commits: GitCommit[] = results[0], refData: GitRefData | string = results[1], stashes: GitStash[] = results[2], remotes: string[] = results[3], i, unsavedChanges = null;
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
							unsavedChanges = config.showUncommittedChanges() ? await this.getUnsavedChanges(repo) : null;
							if (unsavedChanges !== null) {
								commits.unshift({ hash: UNCOMMITTED, parents: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
							}
							break;
						}
					}
				}

				let commitNodes: GitCommitNode[] = [];
				let commitLookup: { [hash: string]: number } = {};

				for (i = 0; i < commits.length; i++) {
					commitLookup[commits[i].hash] = i;
					commitNodes.push({ hash: commits[i].hash, parents: commits[i].parents, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, heads: [], tags: [], remotes: [], stash: null });
				}

				/* Insert Stashes */
				let toAdd: { index: number, data: GitStash }[] = [];
				for (i = 0; i < stashes.length; i++) {
					if (typeof commitLookup[stashes[i].hash] === 'number') {
						commitNodes[commitLookup[stashes[i].hash]].stash = stashes[i].selector;
					} else if (typeof commitLookup[stashes[i].base] === 'number') {
						toAdd.push({ index: commitLookup[stashes[i].base], data: stashes[i] });
					}
				}
				toAdd.sort((a, b) => a.index !== b.index ? a.index - b.index : b.data.date - a.data.date);
				for (i = toAdd.length - 1; i >= 0; i--) {
					let stash = toAdd[i].data;
					commitNodes.splice(toAdd[i].index, 0, { hash: stash.hash, parents: [stash.base], author: stash.author, email: stash.email, date: stash.date, message: stash.message, heads: [], tags: [], remotes: [], stash: stash.selector });
				}
				for (i = 0; i < commitNodes.length; i++) {
					// Correct commit lookup after stashes have been spliced in
					commitLookup[commitNodes[i].hash] = i;
				}

				/* Annotate Heads */
				for (i = 0; i < refData.heads.length; i++) {
					if (typeof commitLookup[refData.heads[i].hash] === 'number') commitNodes[commitLookup[refData.heads[i].hash]].heads.push(refData.heads[i].name);
				}

				/* Annotate Tags */
				for (i = 0; i < refData.tags.length; i++) {
					if (typeof commitLookup[refData.tags[i].hash] === 'number') commitNodes[commitLookup[refData.tags[i].hash]].tags.push({ name: refData.tags[i].name, annotated: refData.tags[i].annotated });
				}

				/* Annotate Remotes */
				for (i = 0; i < refData.remotes.length; i++) {
					if (typeof commitLookup[refData.remotes[i].hash] === 'number') {
						let name = refData.remotes[i].name;
						let remote = remotes.find(remote => name.startsWith(remote + '/'));
						commitNodes[commitLookup[refData.remotes[i].hash]].remotes.push({ name: name, remote: remote ? remote : null });
					}
				}

				resolve({ commits: commitNodes, head: refData.head, remotes: remotes, moreCommitsAvailable: moreCommitsAvailable, error: null });
			}).catch((errorMessage) => {
				resolve({ commits: [], head: null, remotes: [], moreCommitsAvailable: false, error: errorMessage });
			});
		});
	}


	/* Get Data Methods - Commit Details View */

	public getCommitDetails(repo: string, commitHash: string, baseHash: string | null) {
		return new Promise<GitCommitDetails>(resolve => {
			Promise.all([
				this.spawnGit(['show', '--quiet', commitHash, '--format=' + this.gitFormatCommitDetails], repo, (stdout): GitCommitDetails => {
					let lines = stdout.split(EOL_REGEX);
					let lastLine = lines.length - 1;
					while (lines.length > 0 && lines[lastLine] === '') lastLine--;
					let commitInfo = lines[0].split(GIT_LOG_SEPARATOR);
					return {
						hash: commitInfo[0],
						parents: commitInfo[1] !== '' ? commitInfo[1].split(' ') : [],
						author: commitInfo[2],
						email: commitInfo[3],
						date: parseInt(commitInfo[4]),
						committer: commitInfo[5],
						body: lines.slice(1, lastLine + 1).join('\n'),
						fileChanges: [], error: null
					};
				}),
				this.getDiffNameStatus(repo, baseHash !== null ? baseHash : commitHash, commitHash),
				this.getDiffNumStat(repo, baseHash !== null ? baseHash : commitHash, commitHash)
			]).then((results) => {
				results[0].fileChanges = generateFileChanges(results[1], results[2], null);
				resolve(results[0]);
			}).catch((errorMessage) => resolve({ hash: '', parents: [], author: '', email: '', date: 0, committer: '', body: '', fileChanges: [], error: errorMessage }));
		});
	}

	public getUncommittedDetails(repo: string) {
		return new Promise<GitCommitDetails>(resolve => {
			let details: GitCommitDetails = { hash: UNCOMMITTED, parents: [], author: '', email: '', date: 0, committer: '', body: '', fileChanges: [], error: null };
			Promise.all([
				this.getDiffNameStatus(repo, 'HEAD', ''),
				this.getDiffNumStat(repo, 'HEAD', ''),
				this.getStatus(repo)
			]).then((results) => {
				details.fileChanges = generateFileChanges(results[0], results[1], results[2]);
				resolve(details);
			}).catch((errorMessage) => {
				details.error = errorMessage;
				resolve(details);
			});
		});
	}

	public getCommitComparison(repo: string, fromHash: string, toHash: string) {
		return new Promise<GitCommitComparisonData>(resolve => {
			Promise.all([
				this.getDiffNameStatus(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
				this.getDiffNumStat(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
				toHash === UNCOMMITTED ? this.getStatus(repo) : Promise.resolve(null)
			]).then((results) => {
				resolve({
					fileChanges: generateFileChanges(results[0], results[1], results[2]),
					error: null
				});
			}).catch((errorMessage) => {
				resolve({ fileChanges: [], error: errorMessage });
			});
		});
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string) {
		return this._spawnGit(['show', commitHash + ':' + filePath], repo, stdout => {
			let encoding = getConfig().fileEncoding();
			return decode(stdout, encodingExists(encoding) ? encoding : 'utf8');
		});
	}


	/* Get Data Methods - General */

	public async getRemoteUrl(repo: string, remote: string) {
		return new Promise<string | null>(resolve => {
			this.spawnGit(['config', '--get', 'remote.' + remote + '.url'], repo, stdout => stdout.split(EOL_REGEX)[0])
				.then(value => resolve(value))
				.catch(() => resolve(null));
		});
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

	public getTagDetails(repo: string, tagName: string) {
		return new Promise<GitTagDetailsData>(resolve => {
			this.spawnGit(['for-each-ref', 'refs/tags/' + tagName, '--format=' + ['%(objectname)', '%(taggername)', '%(taggeremail)', '%(taggerdate:unix)', '%(contents)'].join(GIT_LOG_SEPARATOR)], repo, (stdout => {
				let data = stdout.split(GIT_LOG_SEPARATOR);
				return {
					tagHash: data[0],
					name: data[1],
					email: data[2].substring(data[2].startsWith('<') ? 1 : 0, data[2].length - (data[2].endsWith('>') ? 1 : 0)),
					date: parseInt(data[3]),
					message: data[4].trim().split(EOL_REGEX).join('\n'),
					error: null
				};
			})).then((data) => {
				resolve(data);
			}).catch((errorMessage) => {
				resolve({ tagHash: '', name: '', email: '', date: 0, message: '', error: errorMessage });
			});
		});
	}

	public getSubmodules(repo: string) {
		return new Promise<string[]>(resolve => {
			fs.readFile(path.join(repo, '.gitmodules'), { encoding: 'utf8' }, async (err, data) => {
				let submodules: string[] = [];
				if (!err) {
					let lines = data.split(EOL_REGEX), inSubmoduleSection = false, match;
					const section = /^\s*\[.*\]\s*$/, submodule = /^\s*\[submodule "([^"]+)"\]\s*$/, pathProp = /^\s*path\s+=\s+(.*)$/;

					for (let i = 0; i < lines.length; i++) {
						if (lines[i].match(section) !== null) {
							inSubmoduleSection = lines[i].match(submodule) !== null;
							continue;
						}

						if (inSubmoduleSection && (match = lines[i].match(pathProp)) !== null) {
							let root = await this.repoRoot(getPathFromUri(Uri.file(path.join(repo, getPathFromStr(match[1])))));
							if (root !== null && !submodules.includes(root)) {
								submodules.push(root);
							}
						}
					}
				}
				resolve(submodules);
			});
		});
	}


	/* Repository Info Methods */

	private areStagedChanges(repo: string) {
		return this.spawnGit(['diff-index', 'HEAD'], repo, (stdout) => stdout !== '').then(changes => changes, () => false);
	}

	public repoRoot(repoPath: string) {
		return this.spawnGit(['rev-parse', '--show-toplevel'], repoPath, (stdout) => getPathFromUri(Uri.file(path.normalize(stdout.trim())))).then(async (canonicalRoot) => {
			let path = repoPath;
			let first = path.indexOf('/');
			while (true) {
				if (canonicalRoot === path || canonicalRoot === await realpath(path)) return path;
				let next = path.lastIndexOf('/');
				if (first !== next && next > -1) {
					path = path.substring(0, next);
				} else {
					return canonicalRoot;
				}
			}
		}).catch(() => null); // null => path is not in a repo
	}


	/* Git Action Methods - Remotes */

	public async addRemote(repo: string, name: string, url: string, pushUrl: string | null, fetch: boolean) {
		let status = await this.runGitCommand(['remote', 'add', name, url], repo);
		if (status !== null) return status;

		if (pushUrl !== null) {
			status = await this.runGitCommand(['remote', 'set-url', name, '--push', pushUrl], repo);
			if (status !== null) return status;
		}

		return fetch ? this.fetch(repo, name, false) : null;
	}

	public deleteRemote(repo: string, name: string) {
		return this.runGitCommand(['remote', 'remove', name], repo);
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

	public pruneRemote(repo: string, name: string) {
		return this.runGitCommand(['remote', 'prune', name], repo);
	}


	/* Git Action Methods - Tags */

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


	/* Git Action Methods - Remote Sync */

	public fetch(repo: string, remote: string | null, prune: boolean) {
		let args = ['fetch', remote === null ? '--all' : remote];
		if (prune) args.push('--prune');

		return this.runGitCommand(args, repo);
	}

	public pushBranch(repo: string, branchName: string, remote: string, setUpstream: boolean, force: boolean) {
		let args = ['push'];
		if (setUpstream) args.push('-u');
		args.push(remote, branchName);
		if (force) args.push('--force');

		return this.runGitCommand(args, repo);
	}

	public pushTag(repo: string, tagName: string, remote: string) {
		return this.runGitCommand(['push', remote, tagName], repo);
	}


	/* Git Action Methods - Branches */

	public checkoutBranch(repo: string, branchName: string, remoteBranch: string | null) {
		let args = ['checkout'];
		if (remoteBranch === null) args.push(branchName);
		else args.push('-b', branchName, remoteBranch);

		return this.runGitCommand(args, repo);
	}

	public createBranch(repo: string, branchName: string, commitHash: string, checkout: boolean) {
		let args = [];
		if (checkout) args.push('checkout', '-b');
		else args.push('branch');
		args.push(branchName, commitHash);

		return this.runGitCommand(args, repo);
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

	public fetchIntoLocalBranch(repo: string, remote: string, remoteBranch: string, localBranch: string) {
		return this.runGitCommand(['fetch', remote, remoteBranch + ':' + localBranch], repo);
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

	public renameBranch(repo: string, oldName: string, newName: string) {
		return this.runGitCommand(['branch', '-m', oldName, newName], repo);
	}


	/* Git Action Methods - Branches & Commits */

	public async merge(repo: string, obj: string, type: BranchOrCommit, createNewCommit: boolean, squash: boolean) {
		let args = ['merge', obj];
		if (squash) args.push('--squash');
		else if (createNewCommit) args.push('--no-ff');

		let mergeStatus = await this.runGitCommand(args, repo);
		if (mergeStatus === null && squash) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand(['commit', '-m', 'Merge ' + type.toLowerCase() + ' \'' + obj + '\''], repo);
			}
		}
		return mergeStatus;
	}

	public rebase(repo: string, obj: string, type: BranchOrCommit, ignoreDate: boolean, interactive: boolean) {
		if (interactive) {
			return new Promise<ErrorInfo>(resolve => {
				if (this.gitExecutable === null) return resolve(UNABLE_TO_FIND_GIT_MSG);

				runGitCommandInNewTerminal(repo, this.gitExecutable.path,
					'rebase --interactive ' + (type === 'Branch' ? obj.replace(/'/g, '"\'"') : obj),
					'Git Rebase on "' + (type === 'Branch' ? obj : abbrevCommit(obj)) + '"');
				setTimeout(() => resolve(null), 1000);
			});
		} else {
			let args = ['rebase', obj];
			if (ignoreDate) args.push('--ignore-date');
			return this.runGitCommand(args, repo);
		}
	}


	/* Git Action Methods - Commits */

	public checkoutCommit(repo: string, commitHash: string) {
		return this.runGitCommand(['checkout', commitHash], repo);
	}

	public cherrypickCommit(repo: string, commitHash: string, parentIndex: number, noCommit: boolean) {
		let args = ['cherry-pick'];
		if (noCommit) args.push('--no-commit');
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		args.push(commitHash);
		return this.runGitCommand(args, repo);
	}

	public dropCommit(repo: string, commitHash: string) {
		return this.runGitCommand(['rebase', '--onto', commitHash + '^', commitHash], repo);
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		return this.runGitCommand(['reset', '--' + resetMode, commitHash], repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		let args = ['revert', '--no-edit', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}


	/* Git Action Methods - Uncommitted */

	public cleanUntrackedFiles(repo: string, directories: boolean) {
		return this.runGitCommand(['clean', '-f' + (directories ? 'd' : '')], repo);
	}


	/* Git Action Methods - Stash */

	public applyStash(repo: string, selector: string) {
		return this.runGitCommand(['stash', 'apply', selector], repo);
	}

	public branchFromStash(repo: string, selector: string, branchName: string) {
		return this.runGitCommand(['stash', 'branch', branchName, selector], repo);
	}

	public dropStash(repo: string, selector: string) {
		return this.runGitCommand(['stash', 'drop', selector], repo);
	}

	public popStash(repo: string, selector: string) {
		return this.runGitCommand(['stash', 'pop', selector], repo);
	}

	public saveStash(repo: string, message: string, includeUntracked: boolean): Promise<ErrorInfo> {
		if (this.gitExecutable === null) {
			return Promise.resolve(UNABLE_TO_FIND_GIT_MSG);
		}
		if (compareVersions(this.gitExecutable, '2.13.2') < 0) {
			return Promise.resolve(constructIncompatibleGitVersionMessage(this.gitExecutable, '2.13.2'));
		}

		let args = ['stash', 'push'];
		if (includeUntracked) args.push('-u');
		if (message !== '') args.push('-m', message);
		return this.runGitCommand(args, repo);
	}


	/* Private Data Providers */

	private async getConfigList(repo: string, type: 'local' | 'global' | 'system') {
		return this.spawnGit(['--no-pager', 'config', '--list', '--' + type], repo, (stdout) => stdout.split(EOL_REGEX));
	}

	private getDiffNameStatus(repo: string, fromHash: string, toHash: string) {
		return this.execDiff(repo, fromHash, toHash, '--name-status');
	}

	private getDiffNumStat(repo: string, fromHash: string, toHash: string) {
		return this.execDiff(repo, fromHash, toHash, '--numstat');
	}

	private getLog(repo: string, branches: string[] | null, num: number, includeTags: boolean, includeRemotes: boolean, order: CommitOrdering) {
		let args = ['log', '--max-count=' + num, '--format=' + this.gitFormatLog, '--' + order + '-order'];
		if (branches !== null) {
			for (let i = 0; i < branches.length; i++) {
				args.push(branches[i]);
			}
		} else {
			// Show All
			args.push('--branches');
			if (includeTags) args.push('--tags');
			if (includeRemotes) args.push('--remotes');
			args.push('HEAD');
		}
		args.push('--');

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			let gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(GIT_LOG_SEPARATOR);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parents: line[1] !== '' ? line[1].split(' ') : [], author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return gitCommits;
		});
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
					let annotated = ref.endsWith('^{}');
					refData.tags.push({ hash: hash, name: (annotated ? ref.substring(10, ref.length - 3) : ref.substring(10)), annotated: annotated });
				} else if (ref.startsWith('refs/remotes/')) {
					refData.remotes.push({ hash: hash, name: ref.substring(13) });
				} else if (ref === 'HEAD') {
					refData.head = hash;
				}
			}
			return refData;
		});
	}

	private getStashes(repo: string) {
		return this.spawnGit(['reflog', '--format=' + this.gitFormatStash, 'refs/stash', '--'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			let stashes: GitStash[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(GIT_LOG_SEPARATOR);
				if (line.length !== 7 || line[1] === '') continue;
				stashes.push({ hash: line[0], base: line[1].split(' ')[0], selector: line[2], author: line[3], email: line[4], date: parseInt(line[5]), message: line[6] });
			}
			return stashes;
		}).catch(() => <GitStash[]>[]);
	}

	private getRemotes(repo: string) {
		return this.spawnGit(['remote'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			lines.pop();
			return lines;
		});
	}

	private getUnsavedChanges(repo: string) {
		return this.spawnGit<GitUnsavedChanges | null>(['status', '-s', '--branch', '--untracked-files', '--porcelain'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			return lines.length > 2
				? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 }
				: null;
		});
	}

	private getStatus(repo: string) {
		return this.spawnGit(['-c', 'core.quotepath=false', 'status', '-s', '--untracked-files', '--porcelain'], repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			let status: GitFileStatus = { deleted: [], untracked: [] };
			let path = '', c1 = '', c2 = '';
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].length < 4) continue;
				path = lines[i].substring(3);
				c1 = lines[i].substring(0, 1);
				c2 = lines[i].substring(1, 2);
				if (c1 === 'D' || c2 === 'D') status.deleted.push(path);
				else if (c1 === '?' || c2 === '?') status.untracked.push(path);
			}
			return status;
		});
	}


	/* Private Utils */

	private execDiff(repo: string, fromHash: string, toHash: string, arg: '--numstat' | '--name-status') {
		let args = ['-c', 'core.quotepath=false'];
		if (fromHash === toHash) {
			args.push('diff-tree', arg, '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', fromHash);
		} else {
			args.push('diff', arg, '-m', '--find-renames', '--diff-filter=AMDR', fromHash);
			if (toHash !== '') args.push(toHash);
		}

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			if (fromHash === toHash) lines.shift();
			return lines;
		});
	}

	private runGitCommand(args: string[], repo: string): Promise<ErrorInfo> {
		return this._spawnGit(args, repo, () => null).catch((errorMessage: string) => errorMessage);
	}

	private spawnGit<T>(args: string[], repo: string, resolveValue: { (stdout: string): T }) {
		return this._spawnGit(args, repo, (stdout) => resolveValue(stdout.toString()));
	}

	private _spawnGit<T>(args: string[], repo: string, resolveValue: { (stdout: Buffer): T }) {
		return new Promise<T>((resolve, reject) => {
			if (this.gitExecutable === null) return reject(UNABLE_TO_FIND_GIT_MSG);

			const cmd = cp.spawn(this.gitExecutable.path, args, {
				cwd: repo,
				env: Object.assign({}, process.env, this.askpassEnv)
			});

			Promise.all([
				new Promise<{ code: number, error: Error | null }>((resolve) => {
					// status promise
					let resolved = false;
					cmd.on('error', (error) => {
						resolve({ code: -1, error: error });
						resolved = true;
					});
					cmd.on('exit', (code) => {
						if (resolved) return;
						resolve({ code: code, error: null });
					});
				}),
				new Promise<Buffer>((resolve) => {
					// stdout promise
					let buffers: Buffer[] = [];
					cmd.stdout.on('data', (b: Buffer) => { buffers.push(b); });
					cmd.stdout.on('close', () => resolve(Buffer.concat(buffers)));
				}),
				new Promise<string>((resolve) => {
					// stderr promise
					let stderr = '';
					cmd.stderr.on('data', (d) => { stderr += d; });
					cmd.stderr.on('close', () => resolve(stderr));
				})
			]).then(values => {
				let status = values[0], stdout = values[1];
				if (status.code === 0) {
					resolve(resolveValue(stdout));
				} else {
					reject(getErrorMessage(status.error, stdout, values[2]));
				}
			});

			this.logger.logCmd('git', args);
		});
	}
}


// Generates a list of file changes from each diff-tree output
function generateFileChanges(nameStatusResults: string[], numStatResults: string[], status: GitFileStatus | null) {
	let fileChanges: GitFileChange[] = [], fileLookup: { [file: string]: number } = {}, i = 0;

	for (i = 0; i < nameStatusResults.length - 1; i++) {
		let line = nameStatusResults[i].split('\t');
		if (line.length < 2) continue;
		let oldFilePath = getPathFromStr(line[1]), newFilePath = getPathFromStr(line[line.length - 1]);
		fileLookup[newFilePath] = fileChanges.length;
		fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
	}

	if (status !== null) {
		let filePath;
		for (i = 0; i < status.deleted.length; i++) {
			filePath = getPathFromStr(status.deleted[i]);
			if (typeof fileLookup[filePath] === 'number') {
				fileChanges[fileLookup[filePath]].type = 'D';
			} else {
				fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: 'D', additions: null, deletions: null });
			}
		}
		for (i = 0; i < status.untracked.length; i++) {
			filePath = getPathFromStr(status.untracked[i]);
			fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: 'U', additions: null, deletions: null });
		}
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

function getErrorMessage(error: Error | null, stdoutBuffer: Buffer, stderr: string) {
	let stdout = stdoutBuffer.toString(), lines: string[];
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


// Types

interface GitFileStatus {
	deleted: string[];
	untracked: string[];
}