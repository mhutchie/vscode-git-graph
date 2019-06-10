import * as fs from 'fs';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { StatusBarItem } from './statusBarItem';
import { GitRepoSet, GitRepoState } from './types';
import { evalPromises, getPathFromUri } from './utils';

export class RepoManager {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly statusBarItem: StatusBarItem;
	private repos: GitRepoSet;
	private maxDepthOfRepoSearch: number;
	private folderWatchers: { [workspace: string]: vscode.FileSystemWatcher } = {};
	private viewCallback: ((repos: GitRepoSet, numRepos: number, loadRepo: string | null) => void) | null = null;
	private folderChangeHandler: vscode.Disposable | null;

	private createEventPaths: string[] = [];
	private changeEventPaths: string[] = [];
	private processCreateEventsTimeout: NodeJS.Timer | null = null;
	private processChangeEventsTimeout: NodeJS.Timer | null = null;

	constructor(dataSource: DataSource, extensionState: ExtensionState, statusBarItem: StatusBarItem) {
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.statusBarItem = statusBarItem;
		this.repos = extensionState.getRepos();
		this.maxDepthOfRepoSearch = getConfig().maxDepthOfRepoSearch();
		this.startupTasks();

		this.folderChangeHandler = vscode.workspace.onDidChangeWorkspaceFolders(async e => {
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
		});
	}

	public dispose() {
		if (this.folderChangeHandler !== null) {
			this.folderChangeHandler.dispose();
			this.folderChangeHandler = null;
		}
		let folders = Object.keys(this.folderWatchers);
		for (let i = 0; i < folders.length; i++) {
			this.stopWatchingFolder(folders[i]);
		}
	}

	public registerViewCallback(viewCallback: (repos: GitRepoSet, numRepos: number, loadRepo: string | null) => void) {
		this.viewCallback = viewCallback;
	}

	public deregisterViewCallback() {
		this.viewCallback = null;
	}

	public maxDepthOfRepoSearchChanged() {
		let newDepth = getConfig().maxDepthOfRepoSearch();
		if (newDepth > this.maxDepthOfRepoSearch) {
			this.maxDepthOfRepoSearch = newDepth;
			this.searchWorkspaceForRepos();
		} else {
			this.maxDepthOfRepoSearch = newDepth;
		}
	}

	private async startupTasks() {
		this.removeReposNotInWorkspace();
		if (!await this.checkReposExist()) this.sendRepos();
		await this.searchWorkspaceForRepos();
		this.startWatchingFolders();
	}

	private removeReposNotInWorkspace() {
		let rootsExact = [], rootsFolder = [], workspaceFolders = vscode.workspace.workspaceFolders, repoPaths = Object.keys(this.repos), path;
		if (typeof workspaceFolders !== 'undefined') {
			for (let i = 0; i < workspaceFolders.length; i++) {
				path = getPathFromUri(workspaceFolders[i].uri);
				rootsExact.push(path);
				rootsFolder.push(path + '/');
			}
		}
		for (let i = 0; i < repoPaths.length; i++) {
			if (rootsExact.indexOf(repoPaths[i]) === -1 && !rootsFolder.find(root => repoPaths[i].startsWith(root)) && !rootsExact.find(root => root.startsWith(repoPaths[i] + '/'))) {
				this.removeRepo(repoPaths[i]);
			}
		}
	}

	// path: the path of the repo being registered
	// expandExistingRepos: if true, in the event that a known repo is within the repo being registered, remove it (excluding subrepos)
	// loadRepo: if true and the Git Graph view is visible, force it to be loaded with the repo that is being registered
	public registerRepo(path: string, expandExistingRepos: boolean, loadRepo: boolean) {
		return new Promise<boolean>(async resolve => {
			if (await this.dataSource.isGitRepository(path)) {
				if (expandExistingRepos) {
					let reposInFolder = this.getReposInFolder(path);
					for (let i = 0; i < reposInFolder.length; i++) {
						// Remove repos within the repo being registered, unless they are a subrepo of a currently known repo
						if (reposInFolder.findIndex(knownRepo => reposInFolder[i].startsWith(knownRepo + '/')) === -1) this.removeRepo(reposInFolder[i]);
					}
				}
				this.addRepo(path);
				this.sendRepos(loadRepo ? path : null);
				resolve(true);
			} else {
				resolve(false);
			}
		});
	}

	/* Repo Management */
	public getRepos() {
		let repoPaths = Object.keys(this.repos).sort(), repos: GitRepoSet = {};
		for (let i = 0; i < repoPaths.length; i++) {
			repos[repoPaths[i]] = this.repos[repoPaths[i]];
		}
		return repos;
	}
	public getRepoContainingFile(path: string) {
		let repoPaths = Object.keys(this.repos), repo = null;
		for (let i = 0; i < repoPaths.length; i++) {
			if (path.startsWith(repoPaths[i] + '/') && (repo === null || repo.length < repoPaths[i].length)) repo = repoPaths[i];
		}
		return repo;
	}
	public getReposInFolder(path: string) {
		let pathFolder = path + '/', repoPaths = Object.keys(this.repos), reposInFolder: string[] = [];
		for (let i = 0; i < repoPaths.length; i++) {
			if (repoPaths[i] === path || repoPaths[i].startsWith(pathFolder)) reposInFolder.push(repoPaths[i]);
		}
		return reposInFolder;
	}
	public isKnownRepo(repo: string) {
		return typeof this.repos[repo] !== 'undefined';
	}
	private addRepo(repo: string) {
		this.repos[repo] = { columnWidths: null };
		this.extensionState.saveRepos(this.repos);
	}
	private removeRepo(repo: string) {
		delete this.repos[repo];
		this.extensionState.saveRepos(this.repos);
	}
	private removeReposWithinFolder(path: string) {
		let reposInFolder = this.getReposInFolder(path);
		for (let i = 0; i < reposInFolder.length; i++) {
			this.removeRepo(reposInFolder[i]);
		}
		return reposInFolder.length > 0;
	}
	private isDirectoryWithinRepos(path: string) {
		let repoPaths = Object.keys(this.repos);
		for (let i = 0; i < repoPaths.length; i++) {
			if (path === repoPaths[i] || path.startsWith(repoPaths[i] + '/')) return true;
		}
		return false;
	}
	private sendRepos(loadRepo?: string | null) {
		let repos = this.getRepos();
		let numRepos = Object.keys(repos).length;
		this.statusBarItem.setNumRepos(numRepos);
		if (this.viewCallback !== null) this.viewCallback(repos, numRepos, loadRepo ? loadRepo : null);
	}
	public checkReposExist() {
		return new Promise<boolean>(resolve => {
			let repoPaths = Object.keys(this.repos), changes = false;
			evalPromises(repoPaths, 3, path => this.dataSource.isGitRepository(path)).then(results => {
				for (let i = 0; i < repoPaths.length; i++) {
					if (!results[i]) {
						this.removeRepo(repoPaths[i]);
						changes = true;
					}
				}
				if (changes) this.sendRepos();
				resolve(changes);
			});
		});
	}
	public setRepoState(repo: string, state: GitRepoState) {
		this.repos[repo] = state;
		this.extensionState.saveRepos(this.repos);
	}

	/* Repo Searching */
	private async searchWorkspaceForRepos() {
		let rootFolders = vscode.workspace.workspaceFolders, changes = false;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				if (await this.searchDirectoryForRepos(getPathFromUri(rootFolders[i].uri), this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		if (changes) this.sendRepos();
	}
	private searchDirectoryForRepos(directory: string, maxDepth: number) { // Returns a promise resolving to a boolean, that indicates if new repositories were found.
		return new Promise<boolean>(resolve => {
			if (this.isDirectoryWithinRepos(directory)) {
				resolve(false);
				return;
			}

			this.dataSource.isGitRepository(directory).then(isRepo => {
				if (isRepo) {
					this.addRepo(directory);
					resolve(true);
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

	/* Workspace Folder Watching */
	private startWatchingFolders() {
		let rootFolders = vscode.workspace.workspaceFolders;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				this.startWatchingFolder(getPathFromUri(rootFolders[i].uri));
			}
		}
	}
	private startWatchingFolder(path: string) {
		let watcher = vscode.workspace.createFileSystemWatcher(path + '/**');
		watcher.onDidCreate(uri => this.onWatcherCreate(uri));
		watcher.onDidChange(uri => this.onWatcherChange(uri));
		watcher.onDidDelete(uri => this.onWatcherDelete(uri));
		this.folderWatchers[path] = watcher;
	}
	private stopWatchingFolder(path: string) {
		this.folderWatchers[path].dispose();
		delete this.folderWatchers[path];
	}
	private async onWatcherCreate(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.createEventPaths.indexOf(path) > -1) return;

		this.createEventPaths.push(path);
		if (this.processCreateEventsTimeout !== null) clearTimeout(this.processCreateEventsTimeout);
		this.processCreateEventsTimeout = setTimeout(() => this.processCreateEvents(), 1000);
	}
	private onWatcherChange(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.changeEventPaths.indexOf(path) > -1) return;

		this.changeEventPaths.push(path);
		if (this.processChangeEventsTimeout !== null) clearTimeout(this.processChangeEventsTimeout);
		this.processChangeEventsTimeout = setTimeout(() => this.processChangeEvents(), 1000);
	}
	private onWatcherDelete(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.removeReposWithinFolder(path)) this.sendRepos();
	}
	private async processCreateEvents() {
		let path, changes = false;
		while (path = this.createEventPaths.shift()) {
			if (await isDirectory(path)) {
				if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		this.processCreateEventsTimeout = null;
		if (changes) this.sendRepos();
	}
	private async processChangeEvents() {
		let path, changes = false;
		while (path = this.changeEventPaths.shift()) {
			if (!await doesPathExist(path)) {
				if (this.removeReposWithinFolder(path)) changes = true;
			}
		}
		this.processChangeEventsTimeout = null;
		if (changes) this.sendRepos();
	}
}

function isDirectory(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, (err, stats) => {
			resolve(err ? false : stats.isDirectory());
		});
	});
}

function doesPathExist(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, err => resolve(!err));
	});
}