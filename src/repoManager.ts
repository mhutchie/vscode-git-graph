import * as fs from 'fs';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { Event, EventEmitter } from './event';
import { DEFAULT_REPO_STATE, ExtensionState } from './extensionState';
import { Logger } from './logger';
import { GitRepoSet, GitRepoState } from './types';
import { evalPromises, getPathFromUri, pathWithTrailingSlash, realpath } from './utils';

export interface RepoChangeEvent {
	repos: GitRepoSet;
	numRepos: number;
	loadRepo: string | null;
}

/**
 * Detects and manages repositories in Git Graph.
 */
export class RepoManager implements vscode.Disposable {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private repos: GitRepoSet;
	private ignoredRepos: string[];
	private maxDepthOfRepoSearch: number;
	private folderWatchers: { [workspace: string]: vscode.FileSystemWatcher } = {};
	private repoEventEmitter: EventEmitter<RepoChangeEvent>;
	private disposables: vscode.Disposable[] = [];

	private createEventQueue: string[] = [];
	private changeEventQueue: string[] = [];
	private processCreateEventsTimeout: NodeJS.Timer | null = null;
	private processChangeEventsTimeout: NodeJS.Timer | null = null;
	private processingCreateEvents: boolean = false;
	private processingChangeEvents: boolean = false;

	/**
	 * Creates the Git Graph Repository Manager, and runs startup tasks.
	 * @param dataSource The Git Graph DataSource instance.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param logger The Git Graph Logger instance.
	 */
	constructor(dataSource: DataSource, extensionState: ExtensionState, onDidChangeConfiguration: Event<vscode.ConfigurationChangeEvent>, logger: Logger) {
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.logger = logger;
		this.repos = extensionState.getRepos();
		this.ignoredRepos = extensionState.getIgnoredRepos();
		this.maxDepthOfRepoSearch = getConfig().maxDepthOfRepoSearch;
		this.repoEventEmitter = new EventEmitter<RepoChangeEvent>();
		this.startupTasks();

		this.disposables.push(
			vscode.workspace.onDidChangeWorkspaceFolders(async e => {
				let changes = false, path;
				if (e.added.length > 0) {
					for (let i = 0; i < e.added.length; i++) {
						path = getPathFromUri(e.added[i].uri);
						if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
						this.startWatchingFolder(path);
					}
				}
				if (e.removed.length > 0) {
					for (let i = 0; i < e.removed.length; i++) {
						path = getPathFromUri(e.removed[i].uri);
						if (this.removeReposWithinFolder(path)) changes = true;
						this.stopWatchingFolder(path);
					}
				}
				if (changes) this.sendRepos();
			}),
			this.repoEventEmitter
		);

		onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				this.maxDepthOfRepoSearchChanged();
			}
		}, this.disposables);
	}

	/**
	 * Disposes the resources used by the RepoManager.
	 */
	public dispose() {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables = [];
		let folders = Object.keys(this.folderWatchers);
		for (let i = 0; i < folders.length; i++) {
			this.stopWatchingFolder(folders[i]);
		}
	}

	/**
	 * Get the Event that can be used to subscribe to updates when the repositories available in Git Graph change.
	 */
	get onDidChangeRepos() {
		return this.repoEventEmitter.subscribe;
	}

	/**
	 * Apply the new value of `git-graph.maxDepthOfRepoSearch` to the RepoManager.
	 */
	private maxDepthOfRepoSearchChanged() {
		const newDepth = getConfig().maxDepthOfRepoSearch;
		if (newDepth > this.maxDepthOfRepoSearch) {
			this.maxDepthOfRepoSearch = newDepth;
			this.searchWorkspaceForRepos();
		} else {
			this.maxDepthOfRepoSearch = newDepth;
		}
	}

	/**
	 * Run various startup tasks when Git Graph is activated.
	 */
	private async startupTasks() {
		this.removeReposNotInWorkspace();
		if (!await this.checkReposExist()) this.sendRepos();
		await this.checkReposForNewSubmodules();
		await this.searchWorkspaceForRepos();
		this.startWatchingFolders();
	}

	/**
	 * Remove any repositories that are no longer in the current workspace.
	 */
	private removeReposNotInWorkspace() {
		let rootsExact = [], rootsFolder = [], workspaceFolders = vscode.workspace.workspaceFolders, repoPaths = Object.keys(this.repos), path;
		if (typeof workspaceFolders !== 'undefined') {
			for (let i = 0; i < workspaceFolders.length; i++) {
				path = getPathFromUri(workspaceFolders[i].uri);
				rootsExact.push(path);
				rootsFolder.push(pathWithTrailingSlash(path));
			}
		}
		for (let i = 0; i < repoPaths.length; i++) {
			let repoPathFolder = pathWithTrailingSlash(repoPaths[i]);
			if (rootsExact.indexOf(repoPaths[i]) === -1 && !rootsFolder.find(root => repoPaths[i].startsWith(root)) && !rootsExact.find(root => root.startsWith(repoPathFolder))) {
				this.removeRepo(repoPaths[i]);
			}
		}
	}

	/**
	 * Register a new repository with Git Graph.
	 * @param path The path of the repository.
	 * @param loadRepo If TRUE and the Git Graph View is visible, load the Git Graph View with the repository being registered.
	 */
	public registerRepo(path: string, loadRepo: boolean) {
		return new Promise<{ root: string | null, error: string | null }>(async resolve => {
			let root = await this.dataSource.repoRoot(path);
			if (root === null) {
				resolve({ root: null, error: 'The folder "' + path + '" is not a Git repository.' });
			} else if (typeof this.repos[root] !== 'undefined') {
				resolve({ root: null, error: 'The folder "' + path + '" is contained within the known repository "' + root + '".' });
			} else {
				if (this.ignoredRepos.includes(root)) {
					this.ignoredRepos.splice(this.ignoredRepos.indexOf(root), 1);
					this.extensionState.setIgnoredRepos(this.ignoredRepos);
				}
				await this.addRepo(root);
				this.sendRepos(loadRepo ? root : null);
				resolve({ root: root, error: null });
			}
		});
	}

	/**
	 * Ignore a repository known to Git Graph. Unlike `removeRepo`, ignoring the repository will prevent it from being automatically detected and re-added the next time Visual Studio Code is started.
	 * @param repo The path of the repository.
	 * @returns TRUE => Repository was ignored, FALSE => Repository is not know to Git Graph.
	 */
	public ignoreRepo(repo: string) {
		if (this.isKnownRepo(repo)) {
			if (!this.ignoredRepos.includes(repo)) this.ignoredRepos.push(repo);
			this.extensionState.setIgnoredRepos(this.ignoredRepos);
			this.removeRepo(repo);
			this.sendRepos();
			return true;
		} else {
			return false;
		}
	}


	/* Repo Management */

	/**
	 * Get a set of all known repositories in the current workspace.
	 * @returns The set of repositories.
	 */
	public getRepos() {
		let repoPaths = Object.keys(this.repos).sort(), repos: GitRepoSet = {};
		for (let i = 0; i < repoPaths.length; i++) {
			repos[repoPaths[i]] = this.repos[repoPaths[i]];
		}
		return repos;
	}

	/**
	 * Get the number of all known repositories in the current workspace.
	 * @returns The number of repositories.
	 */
	public getNumRepos() {
		return Object.keys(this.repos).length;
	}

	/**
	 * Get the repository that contains the specified file.
	 * @param path The path of the file.
	 * @returns The path of the repository containing the file, or NULL if no known repository contains the file.
	 */
	public getRepoContainingFile(path: string) {
		let repoPaths = Object.keys(this.repos), repo = null;
		for (let i = 0; i < repoPaths.length; i++) {
			if (path.startsWith(pathWithTrailingSlash(repoPaths[i])) && (repo === null || repo.length < repoPaths[i].length)) repo = repoPaths[i];
		}
		return repo;
	}

	/**
	 * Get all known repositories that are contained in the specified folder.
	 * @param path The path of the folder.
	 * @returns An array of the paths of all known repositories contained in the specified folder.
	 */
	private getReposInFolder(path: string) {
		let pathFolder = pathWithTrailingSlash(path), repoPaths = Object.keys(this.repos), reposInFolder: string[] = [];
		for (let i = 0; i < repoPaths.length; i++) {
			if (repoPaths[i] === path || repoPaths[i].startsWith(pathFolder)) reposInFolder.push(repoPaths[i]);
		}
		return reposInFolder;
	}

	/**
	 * Get the path of the known repository matching the specified repository path (checking symbolic links if necessary).
	 * @param repo The path of the repository.
	 * @returns The path of the known repository, or NULL if the specified repository is unknown.
	 */
	public async getKnownRepo(repo: string) {
		if (this.isKnownRepo(repo)) {
			// The path is already known as a repo
			return repo;
		}

		// Check to see if a known repository contains a symlink that resolves the repo
		let canonicalRepo = await realpath(repo);
		let repoPaths = Object.keys(this.repos);
		for (let i = 0; i < repoPaths.length; i++) {
			if (canonicalRepo === (await realpath(repoPaths[i]))) {
				return repoPaths[i];
			}
		}

		// Repo is unknown
		return null;
	}

	/**
	 * Check to see if a repository exactly matches a known repository.
	 * @param repo The path of the repository to check.
	 * @returns TRUE => Known repository, FALSE => Unknown repository.
	 */
	public isKnownRepo(repo: string) {
		return typeof this.repos[repo] !== 'undefined';
	}

	/**
	 * Add a new repository to Git Graph.
	 * @param repo The path of the repository.
	 * @returns TRUE => The repository was added, FALSE => The repository is ignored and couldn't be added.
	 */
	private async addRepo(repo: string) {
		if (this.ignoredRepos.includes(repo)) {
			return false;
		} else {
			this.repos[repo] = Object.assign({}, DEFAULT_REPO_STATE);
			this.extensionState.saveRepos(this.repos);
			this.logger.log('Added new repo: ' + repo);
			await this.searchRepoForSubmodules(repo);
			return true;
		}
	}

	/**
	 * Remove a known repository from Git Graph.
	 * @param repo The path of the repository.
	 */
	private removeRepo(repo: string) {
		delete this.repos[repo];
		this.extensionState.saveRepos(this.repos);
		this.logger.log('Removed repo: ' + repo);
	}

	/**
	 * Remove all repositories that are contained within the specified folder.
	 * @param path The path of the folder.
	 * @returns TRUE => At least one repository was removed, FALSE => No repositories were removed.
	 */
	private removeReposWithinFolder(path: string) {
		let reposInFolder = this.getReposInFolder(path);
		for (let i = 0; i < reposInFolder.length; i++) {
			this.removeRepo(reposInFolder[i]);
		}
		return reposInFolder.length > 0;
	}

	/**
	 * Checks if the specified path is within a known repository.
	 * @param path The path to check.
	 * @returns TRUE => Path is within a known repository, FALSE => Path isn't within a known repository.
	 */
	private isDirectoryWithinRepos(path: string) {
		let repoPaths = Object.keys(this.repos);
		for (let i = 0; i < repoPaths.length; i++) {
			if (path === repoPaths[i] || path.startsWith(pathWithTrailingSlash(repoPaths[i]))) return true;
		}
		return false;
	}

	/**
	 * Send the latest set of known repositories to subscribers as they have changed.
	 * @param loadRepo The optional path of a repository to load in the Git Graph View.
	 */
	private sendRepos(loadRepo: string | null = null) {
		this.repoEventEmitter.emit({
			repos: this.getRepos(),
			numRepos: this.getNumRepos(),
			loadRepo: loadRepo
		});
	}

	/**
	 * Check that all known repositories still exist. If they don't, remove them.
	 * @returns TRUE => At least one repository was removed or transferred, FALSE => No repositories were removed.
	 */
	public checkReposExist() {
		return new Promise<boolean>(resolve => {
			let repoPaths = Object.keys(this.repos), changes = false;
			evalPromises(repoPaths, 3, path => this.dataSource.repoRoot(path)).then(results => {
				for (let i = 0; i < repoPaths.length; i++) {
					if (results[i] === null) {
						this.removeRepo(repoPaths[i]);
						changes = true;
					} else if (repoPaths[i] !== results[i]) {
						this.transferRepoState(repoPaths[i], results[i]!);
						changes = true;
					}
				}
				if (changes) this.sendRepos();
				resolve(changes);
			});
		});
	}

	/**
	 * Set the state of a known repository.
	 * @param repo The repository the state belongs to.
	 * @param state The state.
	 */
	public setRepoState(repo: string, state: GitRepoState) {
		this.repos[repo] = state;
		this.extensionState.saveRepos(this.repos);
	}

	/**
	 * Transfer the repository state from one known repository to another.
	 * @param oldRepo The repository to transfer the state from.
	 * @param newRepo The repository to transfer the state to.
	 */
	private transferRepoState(oldRepo: string, newRepo: string) {
		this.repos[newRepo] = this.repos[oldRepo];
		delete this.repos[oldRepo];
		this.extensionState.saveRepos(this.repos);
		this.extensionState.transferRepo(oldRepo, newRepo);

		this.logger.log('Transferred repo state: ' + oldRepo + ' -> ' + newRepo);
	}


	/* Repo Searching */

	/**
	 * Search all of the current workspace folders for new repositories (and add them).
	 * @returns TRUE => At least one repository was added, FALSE => No repositories were added.
	 */
	public async searchWorkspaceForRepos() {
		this.logger.log('Searching workspace for new repos ...');
		let rootFolders = vscode.workspace.workspaceFolders, changes = false;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				if (await this.searchDirectoryForRepos(getPathFromUri(rootFolders[i].uri), this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		this.logger.log('Completed searching workspace for new repos');
		if (changes) this.sendRepos();
		return changes;
	}

	/**
	 * Search the specified directory for new repositories (and add them).
	 * @param directory The path of the directory to search.
	 * @param maxDepth The maximum depth to recursively search.
	 * @returns TRUE => At least one repository was added, FALSE => No repositories were added.
	 */
	private searchDirectoryForRepos(directory: string, maxDepth: number) {
		return new Promise<boolean>(resolve => {
			if (this.isDirectoryWithinRepos(directory)) {
				resolve(false);
				return;
			}

			this.dataSource.repoRoot(directory).then(async (root) => {
				if (root !== null) {
					resolve(await this.addRepo(root));
				} else if (maxDepth > 0) {
					fs.readdir(directory, async (err, dirContents) => {
						if (err) {
							resolve(false);
						} else {
							let dirs = [];
							for (let i = 0; i < dirContents.length; i++) {
								if (dirContents[i] !== '.git' && await isDirectory(directory + '/' + dirContents[i])) {
									dirs.push(directory + '/' + dirContents[i]);
								}
							}
							resolve((await evalPromises(dirs, 2, dir => this.searchDirectoryForRepos(dir, maxDepth - 1))).indexOf(true) > -1);
						}
					});
				} else {
					resolve(false);
				}
			}).catch(() => resolve(false));
		});
	}

	/**
	 * Check the know repositories for any new submodules (and add them).
	 */
	private async checkReposForNewSubmodules() {
		let repoPaths = Object.keys(this.repos), changes = false;
		for (let i = 0; i < repoPaths.length; i++) {
			if (await this.searchRepoForSubmodules(repoPaths[i])) changes = true;
		}
		if (changes) this.sendRepos();
	}

	/**
	 * Search a repository for any new submodules (and add them).
	 * @param repo The path of the repository to search.
	 * @returns TRUE => At least one submodule was added, FALSE => No submodules were added.
	 */
	private async searchRepoForSubmodules(repo: string) {
		let submodules = await this.dataSource.getSubmodules(repo), changes = false;
		for (let i = 0; i < submodules.length; i++) {
			if (!this.isKnownRepo(submodules[i])) {
				if (await this.addRepo(submodules[i])) changes = true;
			}
		}
		return changes;
	}


	/* Workspace Folder Watching */

	/**
	 * Start watching each of the folders in the current workspace for changes.
	 */
	private startWatchingFolders() {
		let rootFolders = vscode.workspace.workspaceFolders;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				this.startWatchingFolder(getPathFromUri(rootFolders[i].uri));
			}
		}
	}

	/**
	 * Start watching the specified directory for file system events.
	 * @param path The path of the directory.
	 */
	private startWatchingFolder(path: string) {
		let watcher = vscode.workspace.createFileSystemWatcher(path + '/**');
		watcher.onDidCreate(uri => this.onWatcherCreate(uri));
		watcher.onDidChange(uri => this.onWatcherChange(uri));
		watcher.onDidDelete(uri => this.onWatcherDelete(uri));
		this.folderWatchers[path] = watcher;
	}

	/**
	 * Stop watching the specified directory for file system events.
	 * @param path The path of the directory.
	 */
	private stopWatchingFolder(path: string) {
		this.folderWatchers[path].dispose();
		delete this.folderWatchers[path];
	}

	/**
	 * Process a file system creation event.
	 * @param uri The URI of the creation event.
	 */
	private onWatcherCreate(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.createEventQueue.indexOf(path) > -1) return;

		this.createEventQueue.push(path);

		if (!this.processingCreateEvents) {
			if (this.processCreateEventsTimeout !== null) {
				clearTimeout(this.processCreateEventsTimeout);
			}
			this.processCreateEventsTimeout = setTimeout(() => {
				this.processCreateEventsTimeout = null;
				this.processCreateEvents();
			}, 1000);
		}
	}

	/**
	 * Process a file system change event.
	 * @param uri The URI of the change event.
	 */
	private onWatcherChange(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.changeEventQueue.indexOf(path) > -1) return;

		this.changeEventQueue.push(path);

		if (!this.processingChangeEvents) {
			if (this.processChangeEventsTimeout !== null) {
				clearTimeout(this.processChangeEventsTimeout);
			}
			this.processChangeEventsTimeout = setTimeout(() => {
				this.processChangeEventsTimeout = null;
				this.processChangeEvents();
			}, 1000);
		}
	}

	/**
	 * Process a file system deletion event.
	 * @param uri The URI of the deletion event.
	 */
	private onWatcherDelete(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.removeReposWithinFolder(path)) this.sendRepos();
	}

	/**
	 * Process the queue of file system creation events.
	 */
	private async processCreateEvents() {
		this.processingCreateEvents = true;
		let path, changes = false;
		while (path = this.createEventQueue.shift()) {
			if (await isDirectory(path)) {
				if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		this.processingCreateEvents = false;
		if (changes) this.sendRepos();
	}

	/**
	 * Process the queue of file system change events
	 */
	private async processChangeEvents() {
		this.processingChangeEvents = true;
		let path, changes = false;
		while (path = this.changeEventQueue.shift()) {
			if (!await doesPathExist(path)) {
				if (this.removeReposWithinFolder(path)) changes = true;
			}
		}
		this.processingChangeEvents = false;
		if (changes) this.sendRepos();
	}
}

/**
 * Check if the specified path is a directory.
 * @param path The path to check.
 * @returns TRUE => Directory, FALSE => Not a directory.
 */
function isDirectory(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, (err, stats) => {
			resolve(err ? false : stats.isDirectory());
		});
	});
}

/**
 * Check if the specified path exists.
 * @param path The path to check.
 * @returns TRUE => Path exists, FALSE => Path doesn't exist.
 */
function doesPathExist(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, err => resolve(!err));
	});
}