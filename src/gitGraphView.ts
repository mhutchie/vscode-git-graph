import * as path from 'path';
import * as vscode from 'vscode';
import { AssetLoader } from './assetLoader';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { encodeDiffDocUri } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { RepoFileWatcher } from './repoFileWatcher';
import { RepoManager } from './repoManager';
import { GitFileChangeType, GitGraphViewState, GitRepoSet, RequestMessage, ResponseMessage } from './types';
import { abbrevCommit, copyToClipboard } from './utils';
import { WebviewHtmlGenerator } from './webviewHtmlGenerator';

export class GitGraphView {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly assetLoader: AssetLoader;
	private readonly avatarManager: AvatarManager;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly repoFileWatcher: RepoFileWatcher;
	private readonly repoManager: RepoManager;
	private disposables: vscode.Disposable[] = [];
	private isGraphViewLoaded: boolean = false;
	private isPanelVisible: boolean = true;
	private currentRepo: string | null = null;

	public static createOrShow(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (GitGraphView.currentPanel) {
			GitGraphView.currentPanel.panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel('git-graph', 'Git Graph', column || vscode.ViewColumn.One, {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(path.join(extensionPath, 'media'))
			]
		});

		GitGraphView.currentPanel = new GitGraphView(panel, extensionPath, dataSource, extensionState, avatarManager, repoManager);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager) {
		this.panel = panel;
		this.assetLoader = new AssetLoader(extensionPath);
		this.avatarManager = avatarManager;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.repoManager = repoManager;
		this.avatarManager.registerView(this);

		panel.iconPath = getConfig().tabIconColourTheme() === 'colour'
			? this.assetLoader.getUri('resources', 'webview-icon.svg')
			: {
					light: this.assetLoader.getUri('resources', 'webview-icon-light.svg'),
					dark: this.assetLoader.getUri('resources', 'webview-icon-dark.svg')
				};

		this.update();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.onDidChangeViewState(() => {
			if (this.panel.visible !== this.isPanelVisible) {
				if (this.panel.visible) {
					this.update();
				} else {
					this.currentRepo = null;
					this.repoFileWatcher.stop();
				}
				this.isPanelVisible = this.panel.visible;
			}
		}, null, this.disposables);

		this.repoFileWatcher = new RepoFileWatcher(() => {
			if (this.panel.visible) {
				this.sendMessage({ command: 'refresh' });
			}
		});
		this.repoManager.registerViewCallback((repos: GitRepoSet, numRepos: number) => {
			if (!this.panel.visible) return;
			if ((numRepos === 0 && this.isGraphViewLoaded) || (numRepos > 0 && !this.isGraphViewLoaded)) {
				this.update();
			} else {
				this.respondLoadRepos(repos);
			}
		});

		this.panel.webview.onDidReceiveMessage(async (msg: RequestMessage) => {
			if (this.dataSource === null) return;
			this.repoFileWatcher.mute();
			switch (msg.command) {
				case 'addTag':
					this.sendMessage({
						command: 'addTag',
						status: await this.dataSource.addTag(msg.repo, msg.tagName, msg.commitHash, msg.lightweight, msg.message)
					});
					break;
				case 'fetchAvatar':
					this.avatarManager.fetchAvatarImage(msg.email, msg.repo, msg.commits);
					break;
				case 'checkoutBranch':
					this.sendMessage({
						command: 'checkoutBranch',
						status: await this.dataSource.checkoutBranch(msg.repo, msg.branchName, msg.remoteBranch)
					});
					break;
				case 'checkoutCommit':
					this.sendMessage({
						command: 'checkoutCommit',
						status: await this.dataSource.checkoutCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'cherrypickCommit':
					this.sendMessage({
						command: 'cherrypickCommit',
						status: await this.dataSource.cherrypickCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					break;
				case 'commitDetails':
					this.sendMessage({
						command: 'commitDetails',
						commitDetails: await this.dataSource.commitDetails(msg.repo, msg.commitHash)
					});
					break;
				case 'copyToClipboard':
					this.sendMessage({
						command: 'copyToClipboard',
						type: msg.type,
						success: await copyToClipboard(msg.data)
					});
					break;
				case 'createBranch':
					this.sendMessage({
						command: 'createBranch',
						status: await this.dataSource.createBranch(msg.repo, msg.branchName, msg.commitHash)
					});
					break;
				case 'deleteBranch':
					this.sendMessage({
						command: 'deleteBranch',
						status: await this.dataSource.deleteBranch(msg.repo, msg.branchName, msg.forceDelete)
					});
					break;
				case 'deleteTag':
					this.sendMessage({
						command: 'deleteTag',
						status: await this.dataSource.deleteTag(msg.repo, msg.tagName)
					});
					break;
				case 'loadBranches':
					let branchData = await this.dataSource.getBranches(msg.repo, msg.showRemoteBranches), isRepo = true;
					if (branchData.error) {
						// If an error occurred, check to make sure the repo still exists
						isRepo = await this.dataSource.isGitRepository(msg.repo);
					}
					this.sendMessage({
						command: 'loadBranches',
						branches: branchData.branches,
						head: branchData.head,
						hard: msg.hard,
						isRepo: isRepo
					});
					if (msg.repo !== this.currentRepo) {
						this.currentRepo = msg.repo;
						this.extensionState.setLastActiveRepo(msg.repo);
						this.repoFileWatcher.start(msg.repo);
					}
					break;
				case 'loadCommits':
					this.sendMessage({
						command: 'loadCommits',
						... await this.dataSource.getCommits(msg.repo, msg.branchName, msg.maxCommits, msg.showRemoteBranches),
						hard: msg.hard
					});
					break;
				case 'loadRepos':
					if (!msg.check || !await this.repoManager.checkReposExist()) {
						// If not required to check repos, or no changes were found when checking, respond with repos
						this.respondLoadRepos(this.repoManager.getRepos());
					}
					break;
				case 'mergeBranch':
					this.sendMessage({
						command: 'mergeBranch',
						status: await this.dataSource.mergeBranch(msg.repo, msg.branchName, msg.createNewCommit)
					});
					break;
				case 'mergeCommit':
					this.sendMessage({
						command: 'mergeCommit',
						status: await this.dataSource.mergeCommit(msg.repo, msg.commitHash, msg.createNewCommit)
					});
					break;
				case 'pushTag':
					this.sendMessage({
						command: 'pushTag',
						status: await this.dataSource.pushTag(msg.repo, msg.tagName)
					});
					break;
				case 'renameBranch':
					this.sendMessage({
						command: 'renameBranch',
						status: await this.dataSource.renameBranch(msg.repo, msg.oldName, msg.newName)
					});
					break;
				case 'resetToCommit':
					this.sendMessage({
						command: 'resetToCommit',
						status: await this.dataSource.resetToCommit(msg.repo, msg.commitHash, msg.resetMode)
					});
					break;
				case 'revertCommit':
					this.sendMessage({
						command: 'revertCommit',
						status: await this.dataSource.revertCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					break;
				case 'saveRepoState':
					this.repoManager.setRepoState(msg.repo, msg.state);
					break;
				case 'viewDiff':
					this.sendMessage({
						command: 'viewDiff',
						success: await this.viewDiff(msg.repo, msg.commitHash, msg.oldFilePath, msg.newFilePath, msg.type)
					});
					break;
			}
			this.repoFileWatcher.unmute();
		}, null, this.disposables);
	}

	public sendMessage(msg: ResponseMessage) {
		this.panel.webview.postMessage(msg);
	}

	public dispose() {
		GitGraphView.currentPanel = undefined;
		this.panel.dispose();
		this.avatarManager.deregisterView();
		this.repoFileWatcher.stop();
		this.repoManager.deregisterViewCallback();
		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) x.dispose();
		}
	}

	private async update() {
		const config = getConfig();
		const viewState: GitGraphViewState = {
			autoCenterCommitDetailsView: config.autoCenterCommitDetailsView(),
			dateFormat: config.dateFormat(),
			fetchAvatars: config.fetchAvatars() && this.extensionState.isAvatarStorageAvailable(),
			graphColours: config.graphColours(),
			graphStyle: config.graphStyle(),
			initialLoadCommits: config.initialLoadCommits(),
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadMoreCommits: config.loadMoreCommits(),
			repos: this.repoManager.getRepos(),
			showCurrentBranchByDefault: config.showCurrentBranchByDefault()
		};
		this.panel.webview.html = await new WebviewHtmlGenerator(this.assetLoader, viewState).getHtmlForWebview();
		const numRepos = Object.keys(this.repoManager.getRepos()).length;
		this.isGraphViewLoaded = numRepos > 0;
	}

	private respondLoadRepos(repos: GitRepoSet) {
		this.sendMessage({
			command: 'loadRepos',
			repos: repos,
			lastActiveRepo: this.extensionState.getLastActiveRepo()
		});
	}

	private viewDiff(repo: string, commitHash: string, oldFilePath: string, newFilePath: string, type: GitFileChangeType) {
		let abbrevHash = abbrevCommit(commitHash);
		let pathComponents = newFilePath.split('/');
		let title = pathComponents[pathComponents.length - 1] + ' (' + (type === 'A' ? 'Added in ' + abbrevHash : type === 'D' ? 'Deleted in ' + abbrevHash : abbrevCommit(commitHash) + '^ ↔ ' + abbrevCommit(commitHash)) + ')';
		return new Promise<boolean>((resolve) => {
			vscode.commands.executeCommand('vscode.diff', encodeDiffDocUri(repo, oldFilePath, commitHash + '^'), encodeDiffDocUri(repo, newFilePath, commitHash), title, { preview: true })
				.then(() => resolve(true))
				.then(() => resolve(false));
		});
	}
}
