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
	private folderWatchers: { [workspace: string]: { create: vscode.FileSystemWatcher, delete: vscode.FileSystemWatcher } } = {};
	private viewCallback: ((repos: GitRepoSet, numRepos: number) => void) | null = null;
	private folderChangeHandler: vscode.Disposable | null;

	constructor(dataSource: DataSource, extensionState: ExtensionState, statusBarItem: StatusBarItem) {
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.statusBarItem = statusBarItem;
		this.repos = extensionState.getRepos();
		this.maxDepthOfRepoSearch = getConfig().maxDepthOfRepoSearch();
		this.removeReposNotInWorkspace();
		this.sendRepos();
		this.searchWorkspaceForRepos();
		this.startWatchingFolders();

		this.folderChangeHandler = vscode.workspace.onDidChangeWorkspaceFolders(async e => {
			if (e.added.length > 0) {
				let path, changes = false;
				for (let i = 0; i < e.added.length; i++) {
					path = getPathFromUri(e.added[i].uri);
					if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
					this.startWatchingFolder(path);
				}
				if (changes) this.sendRepos();
			}
			if (e.removed.length > 0) {
				let changes = false, path;
				for (let i = 0; i < e.removed.length; i++) {
					path = getPathFromUri(e.removed[i].uri);
					if (this.removeReposWithinFolder(path)) changes = true;
					this.stopWatchingFolder(path);
				}
				if (changes) this.sendRepos();
			}
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

	// Gets all known repos, checking to ensure they still exist.
	public getRepos(notify: boolean) {
		return new Promise<GitRepoSet>(resolve => {
			let repoPaths = Object.keys(this.repos).sort(), repos: GitRepoSet = {}, changes = false;
			evalPromises(repoPaths, 3, path => this.dataSource.isGitRepository(path)).then(results => {
				for (let i = 0; i < repoPaths.length; i++) {
					if (results[i]) {
						repos[repoPaths[i]] = this.repos[repoPaths[i]];
					} else {
						this.removeRepo(repoPaths[i]);
						changes = true;
					}
				}
				if (notify && changes) this.statusBarItem.setNumRepos(Object.keys(repos).length);
				resolve(repos);
			});
		});
	}

	public registerViewCallback(viewCallback: (repos: GitRepoSet, numRepos: number) => void) {
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
			if (rootsExact.indexOf(repoPaths[i]) === -1 && !rootsFolder.find(x => repoPaths[i].startsWith(x))) this.removeRepo(repoPaths[i]);
		}
	}

	/* Repo State Management */
	private addRepo(repo: string) {
		this.repos[repo] = { columnWidths: null };
		this.extensionState.saveRepos(this.repos);
	}
	private removeRepo(repo: string) {
		delete this.repos[repo];
		this.extensionState.saveRepos(this.repos);
	}
	private removeReposWithinFolder(path: string) {
		if (path.indexOf('/.git/') > -1) return;
		let pathExact = path.endsWith('/.git') ? path.slice(0, -5) : path;
		let pathFolder = pathExact + '/', repoPaths = Object.keys(this.repos), changes = false;
		for (let i = 0; i < repoPaths.length; i++) {
			if (repoPaths[i] === pathExact || repoPaths[i].startsWith(pathFolder)) {
				this.removeRepo(repoPaths[i]);
				changes = true;
			}
		}
		return changes;
	}
	private async sendRepos() {
		let repos = await this.getRepos(false);
		let numRepos = Object.keys(repos).length;
		this.statusBarItem.setNumRepos(numRepos);
		if (this.viewCallback !== null) this.viewCallback(repos, numRepos);
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
			if (typeof this.repos[directory] !== 'undefined') {
				resolve(false);
				return;
			}

			fs.readdir(directory, async (err, dirContents) => {
				if (!err) {
					if (dirContents.indexOf('.git') > -1 && await this.dataSource.isGitRepository(directory)) {
						this.addRepo(directory);
						resolve(true);
						return;
					} else if (maxDepth > 0) {
						let dirs = [];
						for (let i = 0; i < dirContents.length; i++) {
							if (await isDirectory(directory + '/' + dirContents[i])) {
								dirs.push(directory + '/' + dirContents[i]);
							}
						}
						resolve((await evalPromises(dirs, 2, dir => this.searchDirectoryForRepos(dir, maxDepth - 1))).indexOf(true) > -1);
						return;
					}
				}
				resolve(false);
			});
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
		let createWatcher = vscode.workspace.createFileSystemWatcher(path + '/**/.git', false, true, true);
		createWatcher.onDidCreate(uri => this.onWatcherCreate(uri));
		let deleteWatcher = vscode.workspace.createFileSystemWatcher(path + '/**', true, true, false);
		deleteWatcher.onDidDelete(uri => this.onWatcherDelete(uri));
		this.folderWatchers[path] = { create: createWatcher, delete: deleteWatcher };
	}
	private stopWatchingFolder(path: string) {
		this.folderWatchers[path].create.dispose();
		this.folderWatchers[path].delete.dispose();
		delete this.folderWatchers[path];
	}
	private async onWatcherCreate(uri: vscode.Uri) {
		let path = getPathFromUri(uri).slice(0, -5);
		if (typeof this.repos[path] === 'undefined' && await this.dataSource.isGitRepository(path)) {
			this.addRepo(path);
			this.sendRepos();
		}
	}
	private onWatcherDelete(uri: vscode.Uri) {
		if (this.removeReposWithinFolder(getPathFromUri(uri))) this.sendRepos();
	}
}

function isDirectory(source: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(source, (err, stats) => {
			resolve(err ? false : stats.isDirectory());
		});
	});
}