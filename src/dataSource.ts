import * as cp from 'child_process';
import * as fs from 'fs';
import { decode, encodingExists } from 'iconv-lite';
import * as path from 'path';
import { Uri } from 'vscode';
import { AskpassEnvironment, AskpassManager } from './askpass/askpassManager';
import { getConfig } from './config';
import { Logger } from './logger';
import { ActionOn, CommitOrdering, DateType, ErrorInfo, GitCommit, GitCommitDetails, GitCommitStash, GitConfigLocation, GitFileChange, GitFileStatus, GitPushBranchMode, GitRepoSettings, GitResetMode, GitSignatureStatus } from './types';
import { abbrevCommit, constructIncompatibleGitVersionMessage, getPathFromStr, getPathFromUri, GitExecutable, isGitAtLeastVersion, realpath, runGitCommandInNewTerminal, UNABLE_TO_FIND_GIT_MSG, UNCOMMITTED } from './utils';


const EOL_REGEX = /\r\n|\r|\n/g;
const INVALID_BRANCH_REGEX = /^\(.* .*\)$/;
const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export const GIT_CONFIG_USER_NAME = 'user.name';
export const GIT_CONFIG_USER_EMAIL = 'user.email';


export class DataSource {
	private readonly logger: Logger;
	private readonly askpassManager: AskpassManager;
	private readonly askpassEnv: AskpassEnvironment;

	private gitExecutable!: GitExecutable | null;
	private gitExecutableSupportsGpgInfo!: boolean;
	private gitFormatCommitDetails!: string;
	private gitFormatLog!: string;
	private gitFormatStash!: string;

	constructor(gitExecutable: GitExecutable | null, logger: Logger) {
		this.logger = logger;
		this.setGitExecutable(gitExecutable);
		this.askpassManager = new AskpassManager();
		this.askpassEnv = this.askpassManager.getEnv();
	}

	public isGitExecutableUnknown() {
		return this.gitExecutable === null;
	}

	public setGitExecutable(gitExecutable: GitExecutable | null) {
		this.gitExecutable = gitExecutable;
		this.gitExecutableSupportsGpgInfo = gitExecutable !== null ? isGitAtLeastVersion(gitExecutable, '2.4.0') : false;
		this.generateGitCommandFormats();
	}

	public generateGitCommandFormats() {
		const config = getConfig();
		const dateType = config.dateType === DateType.Author ? '%at' : '%ct';
		const useMailmap = config.useMailmap;

		this.gitFormatCommitDetails = [
			'%H', '%P', // Hash & Parent Information
			useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, useMailmap ? '%cN' : '%cn', // Author / Commit Information
			...(config.showSignatureStatus && this.gitExecutableSupportsGpgInfo ? ['%G?', '%GS', '%GK'] : ['', '', '']), // GPG Key Information
			'%B' // Body
		].join(GIT_LOG_SEPARATOR);

		this.gitFormatLog = [
			'%H', '%P',// Hash & Parent Information
			useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, // Author / Commit Information
			'%s' // Subject
		].join(GIT_LOG_SEPARATOR);

		this.gitFormatStash = [
			'%H', '%P', '%gD',// Hash, Parent & Selector Information
			useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, // Author / Commit Information
			'%s' // Subject
		].join(GIT_LOG_SEPARATOR);
	}

	public dispose() {
		this.askpassManager.dispose();
	}


	/* Get Data Methods - Core */

	public getRepoInfo(repo: string, showRemoteBranches: boolean, hideRemotes: string[]): Promise<GitRepoInfo> {
		return Promise.all([
			this.getBranches(repo, showRemoteBranches, hideRemotes),
			this.getRemotes(repo)
		]).then((results) => {
			return { branches: results[0].branches, head: results[0].head, remotes: results[1], error: null };
		}).catch((errorMessage) => {
			return { branches: [], head: null, remotes: [], error: errorMessage };
		});
	}

	public getCommits(repo: string, branches: string[] | null, maxCommits: number, showRemoteBranches: boolean, showTags: boolean, remotes: string[], hideRemotes: string[]): Promise<GitCommitData> {
		const config = getConfig();
		return Promise.all([
			this.getLog(repo, branches, maxCommits + 1, showTags && config.showCommitsOnlyReferencedByTags, showRemoteBranches, config.commitOrdering, remotes, hideRemotes),
			this.getRefs(repo, showRemoteBranches, hideRemotes).then((refData: GitRefData) => refData, (errorMessage: string) => errorMessage),
			this.getStashes(repo)
		]).then(async (results) => {
			let commits: GitCommitRecord[] = results[0], refData: GitRefData | string = results[1], stashes: GitStash[] = results[2], i, unsavedChanges = null;
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
						unsavedChanges = config.showUncommittedChanges ? await this.getUnsavedChanges(repo) : null;
						if (unsavedChanges !== null) {
							commits.unshift({ hash: UNCOMMITTED, parents: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
						}
						break;
					}
				}
			}

			let commitNodes: Writeable<GitCommit>[] = [];
			let commitLookup: { [hash: string]: number } = {};

			for (i = 0; i < commits.length; i++) {
				commitLookup[commits[i].hash] = i;
				commitNodes.push({ ...commits[i], heads: [], tags: [], remotes: [], stash: null });
			}

			/* Insert Stashes */
			let toAdd: { index: number, data: GitStash }[] = [];
			for (i = 0; i < stashes.length; i++) {
				if (typeof commitLookup[stashes[i].hash] === 'number') {
					commitNodes[commitLookup[stashes[i].hash]].stash = {
						selector: stashes[i].selector,
						baseHash: stashes[i].baseHash,
						untrackedFilesHash: stashes[i].untrackedFilesHash
					};
				} else if (typeof commitLookup[stashes[i].baseHash] === 'number') {
					toAdd.push({ index: commitLookup[stashes[i].baseHash], data: stashes[i] });
				}
			}
			toAdd.sort((a, b) => a.index !== b.index ? a.index - b.index : b.data.date - a.data.date);
			for (i = toAdd.length - 1; i >= 0; i--) {
				let stash = toAdd[i].data;
				commitNodes.splice(toAdd[i].index, 0, {
					hash: stash.hash,
					parents: [stash.baseHash],
					author: stash.author,
					email: stash.email,
					date: stash.date,
					message: stash.message,
					heads: [], tags: [], remotes: [],
					stash: {
						selector: stash.selector,
						baseHash: stash.baseHash,
						untrackedFilesHash: stash.untrackedFilesHash
					}
				});
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
			if (showTags) {
				for (i = 0; i < refData.tags.length; i++) {
					if (typeof commitLookup[refData.tags[i].hash] === 'number') commitNodes[commitLookup[refData.tags[i].hash]].tags.push({ name: refData.tags[i].name, annotated: refData.tags[i].annotated });
				}
			}

			/* Annotate Remotes */
			for (i = 0; i < refData.remotes.length; i++) {
				if (typeof commitLookup[refData.remotes[i].hash] === 'number') {
					let name = refData.remotes[i].name;
					let remote = remotes.find(remote => name.startsWith(remote + '/'));
					commitNodes[commitLookup[refData.remotes[i].hash]].remotes.push({ name: name, remote: remote ? remote : null });
				}
			}

			return { commits: commitNodes, head: refData.head, moreCommitsAvailable: moreCommitsAvailable, error: null };
		}).catch((errorMessage) => {
			return { commits: [], head: null, moreCommitsAvailable: false, error: errorMessage };
		});
	}


	/* Get Data Methods - Commit Details View */

	public getCommitDetails(repo: string, commitHash: string): Promise<GitCommitDetailsData> {
		return Promise.all([
			this.getCommitDetailsBase(repo, commitHash),
			this.getDiffNameStatus(repo, commitHash, commitHash),
			this.getDiffNumStat(repo, commitHash, commitHash)
		]).then((results) => {
			results[0].fileChanges = generateFileChanges(results[1], results[2], null);
			return { commitDetails: results[0], error: null };
		}).catch((errorMessage) => {
			return { commitDetails: null, error: errorMessage };
		});
	}

	public getStashDetails(repo: string, commitHash: string, stash: GitCommitStash): Promise<GitCommitDetailsData> {
		return Promise.all([
			this.getCommitDetailsBase(repo, commitHash),
			this.getDiffNameStatus(repo, stash.baseHash, commitHash),
			this.getDiffNumStat(repo, stash.baseHash, commitHash),
			stash.untrackedFilesHash !== null ? this.getDiffNameStatus(repo, stash.untrackedFilesHash, stash.untrackedFilesHash) : Promise.resolve([]),
			stash.untrackedFilesHash !== null ? this.getDiffNumStat(repo, stash.untrackedFilesHash, stash.untrackedFilesHash) : Promise.resolve([])
		]).then((results) => {
			results[0].fileChanges = generateFileChanges(results[1], results[2], null);
			if (stash.untrackedFilesHash !== null) {
				generateFileChanges(results[3], results[4], null).forEach((fileChange) => {
					if (fileChange.type === GitFileStatus.Added) {
						fileChange.type = GitFileStatus.Untracked;
						results[0].fileChanges.push(fileChange);
					}
				});
			}
			return { commitDetails: results[0], error: null };
		}).catch((errorMessage) => {
			return { commitDetails: null, error: errorMessage };
		});
	}

	public getUncommittedDetails(repo: string): Promise<GitCommitDetailsData> {
		return Promise.all([
			this.getDiffNameStatus(repo, 'HEAD', ''),
			this.getDiffNumStat(repo, 'HEAD', ''),
			this.getStatus(repo)
		]).then((results) => {
			return {
				commitDetails: {
					hash: UNCOMMITTED, parents: [], author: '', email: '', date: 0, committer: '', signature: null, body: '',
					fileChanges: generateFileChanges(results[0], results[1], results[2])
				},
				error: null
			};
		}).catch((errorMessage) => {
			return { commitDetails: null, error: errorMessage };
		});
	}

	public getCommitComparison(repo: string, fromHash: string, toHash: string): Promise<GitCommitComparisonData> {
		return Promise.all<DiffNameStatusRecord[], DiffNumStatRecord[], GitStatusFiles | null>([
			this.getDiffNameStatus(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
			this.getDiffNumStat(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
			toHash === UNCOMMITTED ? this.getStatus(repo) : Promise.resolve(null)
		]).then((results) => {
			return {
				fileChanges: generateFileChanges(results[0], results[1], results[2]),
				error: null
			};
		}).catch((errorMessage) => {
			return { fileChanges: [], error: errorMessage };
		});
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string) {
		return this._spawnGit(['show', commitHash + ':' + filePath], repo, stdout => {
			let encoding = getConfig().fileEncoding;
			return decode(stdout, encodingExists(encoding) ? encoding : 'utf8');
		});
	}


	/* Get Data Methods - General */

	public getCommitSubject(repo: string, commitHash: string): Promise<string | null> {
		return this.spawnGit(['log', '--format=%s', '-n', '1', commitHash, '--'], repo, (stdout) => {
			return stdout.trim().replace(/\s+/g, ' ');
		}).then((subject) => subject, () => null);
	}

	public getRemoteUrl(repo: string, remote: string): Promise<string | null> {
		return this.spawnGit(['config', '--get', 'remote.' + remote + '.url'], repo, (stdout) => {
			return stdout.split(EOL_REGEX)[0];
		}).then((url) => url, () => null);
	}

	public getRepoSettings(repo: string): Promise<GitRepoSettingsData> {
		return Promise.all([
			this.getConfigList(repo, GitConfigLocation.Local),
			this.getConfigList(repo, GitConfigLocation.Global),
			this.getRemotes(repo)
		]).then((results) => {
			const fetchLocalConfigs = [GIT_CONFIG_USER_NAME, GIT_CONFIG_USER_EMAIL];
			const fetchGlobalConfigs = [GIT_CONFIG_USER_NAME, GIT_CONFIG_USER_EMAIL];
			results[2].forEach((remote) => {
				fetchLocalConfigs.push('remote.' + remote + '.url', 'remote.' + remote + '.pushurl');
			});

			const localConfigs = getConfigs(results[0], fetchLocalConfigs);
			const globalConfigs = getConfigs(results[1], fetchGlobalConfigs);
			return {
				settings: {
					user: {
						name: {
							local: localConfigs[GIT_CONFIG_USER_NAME],
							global: globalConfigs[GIT_CONFIG_USER_NAME]
						},
						email: {
							local: localConfigs[GIT_CONFIG_USER_EMAIL],
							global: globalConfigs[GIT_CONFIG_USER_EMAIL]
						}
					},
					remotes: results[2].map((remote) => ({
						name: remote,
						url: localConfigs['remote.' + remote + '.url'],
						pushUrl: localConfigs['remote.' + remote + '.pushurl']
					}))
				},
				error: null
			};
		}).catch((errorMessage) => {
			return { settings: null, error: errorMessage };
		});
	}

	public getTagDetails(repo: string, tagName: string): Promise<GitTagDetailsData> {
		return this.spawnGit(['for-each-ref', 'refs/tags/' + tagName, '--format=' + ['%(objectname)', '%(taggername)', '%(taggeremail)', '%(taggerdate:unix)', '%(contents)'].join(GIT_LOG_SEPARATOR)], repo, (stdout) => {
			let data = stdout.split(GIT_LOG_SEPARATOR);
			return {
				tagHash: data[0],
				name: data[1],
				email: data[2].substring(data[2].startsWith('<') ? 1 : 0, data[2].length - (data[2].endsWith('>') ? 1 : 0)),
				date: parseInt(data[3]),
				message: removeTrailingBlankLines(data[4].split(EOL_REGEX)).join('\n'),
				error: null
			};
		}).then((data) => {
			return data;
		}).catch((errorMessage) => {
			return { tagHash: '', name: '', email: '', date: 0, message: '', error: errorMessage };
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

	public pushBranch(repo: string, branchName: string, remote: string, setUpstream: boolean, mode: GitPushBranchMode) {
		let args = ['push'];
		args.push(remote, branchName);
		if (setUpstream) args.push('--set-upstream');
		if (mode !== GitPushBranchMode.Normal) args.push('--' + mode);

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

	public async merge(repo: string, obj: string, actionOn: ActionOn, createNewCommit: boolean, squash: boolean, noCommit: boolean) {
		let args = ['merge', obj];

		if (squash) args.push('--squash');
		else if (createNewCommit) args.push('--no-ff');

		if (noCommit) args.push('--no-commit');

		let mergeStatus = await this.runGitCommand(args, repo);
		if (mergeStatus === null && squash && !noCommit) {
			if (await this.areStagedChanges(repo)) {
				return this.runGitCommand(['commit', '-m', 'Merge ' + actionOn.toLowerCase() + ' \'' + obj + '\''], repo);
			}
		}
		return mergeStatus;
	}

	public rebase(repo: string, obj: string, actionOn: ActionOn, ignoreDate: boolean, interactive: boolean) {
		if (interactive) {
			return new Promise<ErrorInfo>(resolve => {
				if (this.gitExecutable === null) return resolve(UNABLE_TO_FIND_GIT_MSG);

				runGitCommandInNewTerminal(repo, this.gitExecutable.path,
					'rebase --interactive ' + (actionOn === ActionOn.Branch ? obj.replace(/'/g, '"\'"') : obj),
					'Git Rebase on "' + (actionOn === ActionOn.Branch ? obj : abbrevCommit(obj)) + '"');
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

	public resetToCommit(repo: string, commit: string, resetMode: GitResetMode) {
		return this.runGitCommand(['reset', '--' + resetMode, commit], repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		let args = ['revert', '--no-edit', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}


	/* Git Action Methods - Config */

	public setConfigValue(repo: string, key: string, value: string, location: GitConfigLocation) {
		return this.runGitCommand(['config', '--' + location, key, value], repo);
	}

	public unsetConfigValue(repo: string, key: string, location: GitConfigLocation) {
		return this.runGitCommand(['config', '--' + location, '--unset-all', key], repo);
	}


	/* Git Action Methods - Uncommitted */

	public cleanUntrackedFiles(repo: string, directories: boolean) {
		return this.runGitCommand(['clean', '-f' + (directories ? 'd' : '')], repo);
	}


	/* Git Action Methods - Stash */

	public applyStash(repo: string, selector: string, reinstateIndex: boolean) {
		let args = ['stash', 'apply'];
		if (reinstateIndex) args.push('--index');
		args.push(selector);

		return this.runGitCommand(args, repo);
	}

	public branchFromStash(repo: string, selector: string, branchName: string) {
		return this.runGitCommand(['stash', 'branch', branchName, selector], repo);
	}

	public dropStash(repo: string, selector: string) {
		return this.runGitCommand(['stash', 'drop', selector], repo);
	}

	public popStash(repo: string, selector: string, reinstateIndex: boolean) {
		let args = ['stash', 'pop'];
		if (reinstateIndex) args.push('--index');
		args.push(selector);

		return this.runGitCommand(args, repo);
	}

	public pushStash(repo: string, message: string, includeUntracked: boolean): Promise<ErrorInfo> {
		if (this.gitExecutable === null) {
			return Promise.resolve(UNABLE_TO_FIND_GIT_MSG);
		}
		if (!isGitAtLeastVersion(this.gitExecutable, '2.13.2')) {
			return Promise.resolve(constructIncompatibleGitVersionMessage(this.gitExecutable, '2.13.2'));
		}

		let args = ['stash', 'push'];
		if (includeUntracked) args.push('--include-untracked');
		if (message !== '') args.push('--message', message);
		return this.runGitCommand(args, repo);
	}


	/* Private Data Providers */

	private getBranches(repo: string, showRemoteBranches: boolean, hideRemotes: string[]) {
		let args = ['branch'];
		if (showRemoteBranches) args.push('-a');
		args.push('--no-color');

		let hideRemotePatterns = hideRemotes.map((remote) => 'remotes/' + remote + '/');

		return this.spawnGit(args, repo, (stdout) => {
			let branchData: GitBranchData = { branches: [], head: null, error: null };
			let lines = stdout.split(EOL_REGEX);
			for (let i = 0; i < lines.length - 1; i++) {
				let name = lines[i].substring(2).split(' -> ')[0];
				if (INVALID_BRANCH_REGEX.test(name) || hideRemotePatterns.some((pattern) => name.startsWith(pattern))) continue;

				if (lines[i][0] === '*') {
					branchData.head = name;
					branchData.branches.unshift(name);
				} else {
					branchData.branches.push(name);
				}
			}
			return branchData;
		});
	}

	private getCommitDetailsBase(repo: string, commitHash: string) {
		return this.spawnGit(['show', '--quiet', commitHash, '--format=' + this.gitFormatCommitDetails], repo, (stdout): Writeable<GitCommitDetails> => {
			const commitInfo = stdout.split(GIT_LOG_SEPARATOR);
			return {
				hash: commitInfo[0],
				parents: commitInfo[1] !== '' ? commitInfo[1].split(' ') : [],
				author: commitInfo[2],
				email: commitInfo[3],
				date: parseInt(commitInfo[4]),
				committer: commitInfo[5],
				signature: ['G', 'U', 'X', 'Y', 'R', 'E', 'B'].includes(commitInfo[6])
					? {
						key: commitInfo[8].trim(),
						signer: commitInfo[7].trim(),
						status: <GitSignatureStatus>commitInfo[6]
					}
					: null,
				body: removeTrailingBlankLines(commitInfo.slice(9).join(GIT_LOG_SEPARATOR).split(EOL_REGEX)).join('\n'),
				fileChanges: []
			};
		});
	}

	private getConfigList(repo: string, location: GitConfigLocation) {
		return this.spawnGit(['--no-pager', 'config', '--list', '--' + location], repo, (stdout) => stdout.split(EOL_REGEX));
	}

	private getDiffNameStatus(repo: string, fromHash: string, toHash: string) {
		return this.execDiff(repo, fromHash, toHash, '--name-status').then((output) => {
			let records: DiffNameStatusRecord[] = [], i = 0;
			while (i < output.length && output[i] !== '') {
				let type = <GitFileStatus>output[i][0];
				if (type === GitFileStatus.Added || type === GitFileStatus.Deleted || type === GitFileStatus.Modified) {
					// Add, Modify, or Delete
					let p = getPathFromStr(output[i + 1]);
					records.push({ type: type, oldFilePath: p, newFilePath: p });
					i += 2;
				} else if (type === GitFileStatus.Renamed) {
					// Rename
					records.push({ type: type, oldFilePath: getPathFromStr(output[i + 1]), newFilePath: getPathFromStr(output[i + 2]) });
					i += 3;
				} else {
					break;
				}
			}
			return records;
		});
	}

	private getDiffNumStat(repo: string, fromHash: string, toHash: string) {
		return this.execDiff(repo, fromHash, toHash, '--numstat').then((output) => {
			let records: DiffNumStatRecord[] = [], i = 0;
			while (i < output.length && output[i] !== '') {
				let fields = output[i].split('\t');
				if (fields.length !== 3) break;
				if (fields[2] !== '') {
					// Add, Modify, or Delete
					records.push({ filePath: getPathFromStr(fields[2]), additions: parseInt(fields[0]), deletions: parseInt(fields[1]) });
					i += 1;
				} else {
					// Rename
					records.push({ filePath: getPathFromStr(output[i + 2]), additions: parseInt(fields[0]), deletions: parseInt(fields[1]) });
					i += 3;
				}
			}
			return records;
		});
	}

	private getLog(repo: string, branches: string[] | null, num: number, includeTags: boolean, includeRemotes: boolean, order: CommitOrdering, remotes: string[], hideRemotes: string[]) {
		let args = ['log', '--max-count=' + num, '--format=' + this.gitFormatLog, '--' + order + '-order'];
		if (branches !== null) {
			for (let i = 0; i < branches.length; i++) {
				args.push(branches[i]);
			}
		} else {
			// Show All
			args.push('--branches');
			if (includeTags) args.push('--tags');
			if (includeRemotes) {
				if (hideRemotes.length === 0) {
					args.push('--remotes');
				} else {
					remotes.filter((remote) => !hideRemotes.includes(remote)).forEach((remote) => {
						args.push('--glob=refs/remotes/' + remote);
					});
				}
			}
			args.push('HEAD');
		}
		args.push('--');

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split(EOL_REGEX);
			let commits: GitCommitRecord[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(GIT_LOG_SEPARATOR);
				if (line.length !== 6) break;
				commits.push({ hash: line[0], parents: line[1] !== '' ? line[1].split(' ') : [], author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return commits;
		});
	}

	private getRefs(repo: string, showRemoteBranches: boolean, hideRemotes: string[]) {
		let args = ['show-ref'];
		if (!showRemoteBranches) args.push('--heads', '--tags');
		args.push('-d', '--head');

		let hideRemotePatterns = hideRemotes.map((remote) => 'refs/remotes/' + remote + '/');

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
					if (!hideRemotePatterns.some((pattern) => ref.startsWith(pattern))) {
						refData.remotes.push({ hash: hash, name: ref.substring(13) });
					}
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
				let parentHashes = line[1].split(' ');
				stashes.push({
					hash: line[0],
					baseHash: parentHashes[0],
					untrackedFilesHash: parentHashes.length === 3 ? parentHashes[2] : null,
					selector: line[2],
					author: line[3],
					email: line[4],
					date: parseInt(line[5]),
					message: line[6]
				});
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
		return this.spawnGit(['status', '-s', '--untracked-files', '--porcelain', '-z'], repo, (stdout) => {
			let output = stdout.split('\0'), i = 0;
			let status: GitStatusFiles = { deleted: [], untracked: [] };
			let path = '', c1 = '', c2 = '';
			while (i < output.length && output[i] !== '') {
				if (output[i].length < 4) break;
				path = output[i].substring(3);
				c1 = output[i].substring(0, 1);
				c2 = output[i].substring(1, 2);
				if (c1 === 'D' || c2 === 'D') status.deleted.push(path);
				else if (c1 === '?' || c2 === '?') status.untracked.push(path);

				if (c1 === 'R' || c2 === 'R' || c1 === 'C' || c2 === 'C') {
					// Renames or copies
					i += 2;
				} else {
					i += 1;
				}
			}
			return status;
		});
	}


	/* Private Utils */

	private execDiff(repo: string, fromHash: string, toHash: string, arg: '--numstat' | '--name-status') {
		let args: string[];
		if (fromHash === toHash) {
			args = ['diff-tree', arg, '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', '-z', fromHash];
		} else {
			args = ['diff', arg, '-m', '--find-renames', '--diff-filter=AMDR', '-z', fromHash];
			if (toHash !== '') args.push(toHash);
		}

		return this.spawnGit(args, repo, (stdout) => {
			let lines = stdout.split('\0');
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
function generateFileChanges(nameStatusRecords: DiffNameStatusRecord[], numStatRecords: DiffNumStatRecord[], status: GitStatusFiles | null) {
	let fileChanges: Writeable<GitFileChange>[] = [], fileLookup: { [file: string]: number } = {}, i = 0;

	for (i = 0; i < nameStatusRecords.length; i++) {
		fileLookup[nameStatusRecords[i].newFilePath] = fileChanges.length;
		fileChanges.push({ oldFilePath: nameStatusRecords[i].oldFilePath, newFilePath: nameStatusRecords[i].newFilePath, type: nameStatusRecords[i].type, additions: null, deletions: null });
	}

	if (status !== null) {
		let filePath;
		for (i = 0; i < status.deleted.length; i++) {
			filePath = getPathFromStr(status.deleted[i]);
			if (typeof fileLookup[filePath] === 'number') {
				fileChanges[fileLookup[filePath]].type = GitFileStatus.Deleted;
			} else {
				fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: GitFileStatus.Deleted, additions: null, deletions: null });
			}
		}
		for (i = 0; i < status.untracked.length; i++) {
			filePath = getPathFromStr(status.untracked[i]);
			fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: GitFileStatus.Untracked, additions: null, deletions: null });
		}
	}

	for (i = 0; i < numStatRecords.length; i++) {
		if (typeof fileLookup[numStatRecords[i].filePath] === 'number') {
			fileChanges[fileLookup[numStatRecords[i].filePath]].additions = numStatRecords[i].additions;
			fileChanges[fileLookup[numStatRecords[i].filePath]].deletions = numStatRecords[i].deletions;
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

function removeTrailingBlankLines(lines: string[]) {
	while (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop();
	}
	return lines;
}


// Types

type Writeable<T> = { -readonly [K in keyof T]: Writeable<T[K]> };

interface DiffNameStatusRecord {
	type: GitFileStatus;
	oldFilePath: string;
	newFilePath: string;
}

interface DiffNumStatRecord {
	filePath: string;
	additions: number;
	deletions: number;
}

interface GitBranchData {
	branches: string[];
	head: string | null;
	error: ErrorInfo;
}

interface GitCommitRecord {
	hash: string;
	parents: string[];
	author: string;
	email: string;
	date: number;
	message: string;
}

interface GitCommitData {
	commits: GitCommit[];
	head: string | null;
	moreCommitsAvailable: boolean;
	error: ErrorInfo;
}

export interface GitCommitDetailsData {
	commitDetails: GitCommitDetails | null;
	error: ErrorInfo;
}

interface GitCommitComparisonData {
	fileChanges: GitFileChange[];
	error: ErrorInfo;
}

interface GitRef {
	hash: string;
	name: string;
}

interface GitRefTag extends GitRef {
	annotated: boolean;
}

interface GitRefData {
	head: string | null;
	heads: GitRef[];
	tags: GitRefTag[];
	remotes: GitRef[];
}

interface GitRepoInfo extends GitBranchData {
	remotes: string[];
}

interface GitRepoSettingsData {
	settings: GitRepoSettings | null;
	error: ErrorInfo;
}

interface GitStash {
	hash: string;
	baseHash: string;
	untrackedFilesHash: string | null;
	selector: string;
	author: string;
	email: string;
	date: number;
	message: string;
}

interface GitStatusFiles {
	deleted: string[];
	untracked: string[];
}

interface GitTagDetailsData {
	tagHash: string;
	name: string;
	email: string;
	date: number;
	message: string;
	error: ErrorInfo;
}

interface GitUnsavedChanges {
	branch: string;
	changes: number;
}
