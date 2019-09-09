import * as path from 'path';
import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { RepoFileWatcher } from './repoFileWatcher';
import { RepoManager } from './repoManager';
import { GitGraphViewState, GitRepoSet, RequestMessage, ResponseMessage } from './types';
import { copyFilePathToClipboard, copyToClipboard, getNonce, openFile, UNABLE_TO_FIND_GIT_MSG, UNCOMMITTED, viewDiff, viewScm } from './utils';

export class GitGraphView {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private readonly avatarManager: AvatarManager;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly repoFileWatcher: RepoFileWatcher;
	private readonly repoManager: RepoManager;
	private readonly logger: Logger;
	private disposables: vscode.Disposable[] = [];
	private isGraphViewLoaded: boolean = false;
	private isPanelVisible: boolean = true;
	private currentRepo: string | null = null;
	private loadRepo: string | null = null; // Is used by the next call to getHtmlForWebview, and is then reset to null

	public static createOrShow(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager, logger: Logger, loadRepo: string | null) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (GitGraphView.currentPanel) {
			// If Git Graph panel already exists
			if (GitGraphView.currentPanel.isPanelVisible) {
				// If the Git Graph panel is visible
				if (loadRepo !== null && loadRepo !== GitGraphView.currentPanel.currentRepo) {
					GitGraphView.currentPanel.respondLoadRepos(repoManager.getRepos(), loadRepo);
				}
			} else {
				// If the Git Graph panel is not visible 
				GitGraphView.currentPanel.loadRepo = loadRepo;
			}
			GitGraphView.currentPanel.panel.reveal(column);
		} else {
			// If Git Graph panel doesn't already exist
			GitGraphView.currentPanel = new GitGraphView(extensionPath, dataSource, extensionState, avatarManager, repoManager, logger, loadRepo, column);
		}
	}

	private constructor(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager, logger: Logger, loadRepo: string | null, column: vscode.ViewColumn | undefined) {
		this.extensionPath = extensionPath;
		this.avatarManager = avatarManager;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.repoManager = repoManager;
		this.logger = logger;
		this.loadRepo = loadRepo;
		this.avatarManager.registerView(this);

		this.panel = vscode.window.createWebviewPanel('git-graph', 'Git Graph', column || vscode.ViewColumn.One, {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))],
			retainContextWhenHidden: getConfig().retainContextWhenHidden()
		});
		this.panel.iconPath = getConfig().tabIconColourTheme() === 'colour'
			? this.getUri('resources', 'webview-icon.svg')
			: { light: this.getUri('resources', 'webview-icon-light.svg'), dark: this.getUri('resources', 'webview-icon-dark.svg') };

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

		this.repoFileWatcher = new RepoFileWatcher(logger, () => {
			if (this.panel.visible) {
				this.sendMessage({ command: 'refresh' });
			}
		});
		this.repoManager.registerViewCallback((repos: GitRepoSet, numRepos: number, loadRepo: string | null) => {
			if (!this.panel.visible) return;
			if ((numRepos === 0 && this.isGraphViewLoaded) || (numRepos > 0 && !this.isGraphViewLoaded)) {
				this.loadRepo = loadRepo;
				this.update();
			} else {
				this.respondLoadRepos(repos, loadRepo);
			}
		});

		this.panel.webview.onDidReceiveMessage(async (msg: RequestMessage) => {
			if (this.dataSource === null) return;
			this.repoFileWatcher.mute();
			switch (msg.command) {
				case 'addRemote':
					this.sendMessage({
						command: 'addRemote',
						error: await this.dataSource.addRemote(msg.repo, msg.name, msg.url, msg.pushUrl, msg.fetch)
					});
					break;
				case 'addTag':
					this.sendMessage({
						command: 'addTag',
						error: await this.dataSource.addTag(msg.repo, msg.tagName, msg.commitHash, msg.lightweight, msg.message)
					});
					break;
				case 'checkoutBranch':
					this.sendMessage({
						command: 'checkoutBranch',
						error: await this.dataSource.checkoutBranch(msg.repo, msg.branchName, msg.remoteBranch)
					});
					break;
				case 'checkoutCommit':
					this.sendMessage({
						command: 'checkoutCommit',
						error: await this.dataSource.checkoutCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'cherrypickCommit':
					this.sendMessage({
						command: 'cherrypickCommit',
						error: await this.dataSource.cherrypickCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					break;
				case 'cleanUntrackedFiles':
					this.sendMessage({
						command: 'cleanUntrackedFiles',
						error: await this.dataSource.cleanUntrackedFiles(msg.repo, msg.directories)
					});
					break;
				case 'codeReviewFileReviewed':
					this.extensionState.updateCodeReviewFileReviewed(msg.repo, msg.id, msg.filePath);
					break;
				case 'commitDetails':
					let data = await Promise.all([
						msg.commitHash !== UNCOMMITTED ? this.dataSource.getCommitDetails(msg.repo, msg.commitHash) : this.dataSource.getUncommittedDetails(msg.repo),
						msg.avatarEmail !== null ? this.avatarManager.getAvatarImage(msg.avatarEmail) : Promise.resolve(null)
					]);
					this.sendMessage({
						command: 'commitDetails',
						commitDetails: data[0],
						avatar: data[1],
						codeReview: msg.commitHash !== UNCOMMITTED ? this.extensionState.getCodeReview(msg.repo, msg.commitHash) : null,
						refresh: msg.refresh
					});
					break;
				case 'compareCommits':
					this.sendMessage({
						command: 'compareCommits',
						commitHash: msg.commitHash, compareWithHash: msg.compareWithHash,
						... await this.dataSource.getCommitComparison(msg.repo, msg.fromHash, msg.toHash),
						codeReview: msg.toHash !== UNCOMMITTED ? this.extensionState.getCodeReview(msg.repo, msg.fromHash + '-' + msg.toHash) : null,
						refresh: msg.refresh
					});
					break;
				case 'copyFilePath':
					this.sendMessage({
						command: 'copyFilePath',
						success: await copyFilePathToClipboard(msg.repo, msg.filePath)
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
						error: await this.dataSource.createBranch(msg.repo, msg.branchName, msg.commitHash, msg.checkout)
					});
					break;
				case 'deleteBranch':
					this.sendMessage({
						command: 'deleteBranch',
						error: await this.dataSource.deleteBranch(msg.repo, msg.branchName, msg.forceDelete)
					});
					break;
				case 'deleteRemote':
					this.sendMessage({
						command: 'deleteRemote',
						error: await this.dataSource.deleteRemote(msg.repo, msg.name)
					});
					break;
				case 'deleteRemoteBranch':
					this.sendMessage({
						command: 'deleteRemoteBranch',
						error: await this.dataSource.deleteRemoteBranch(msg.repo, msg.branchName, msg.remote)
					});
					break;
				case 'deleteTag':
					this.sendMessage({
						command: 'deleteTag',
						error: await this.dataSource.deleteTag(msg.repo, msg.tagName, msg.deleteOnRemote)
					});
					break;
				case 'dropCommit':
					this.sendMessage({
						command: 'dropCommit',
						error: await this.dataSource.dropCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'editRemote':
					this.sendMessage({
						command: 'editRemote',
						error: await this.dataSource.editRemote(msg.repo, msg.nameOld, msg.nameNew, msg.urlOld, msg.urlNew, msg.pushUrlOld, msg.pushUrlNew)
					});
					break;
				case 'fetch':
					this.sendMessage({
						command: 'fetch',
						error: await this.dataSource.fetch(msg.repo, msg.name, msg.prune)
					});
					break;
				case 'fetchAvatar':
					this.avatarManager.fetchAvatarImage(msg.email, msg.repo, msg.remote, msg.commits);
					break;
				case 'endCodeReview':
					this.extensionState.endCodeReview(msg.repo, msg.id);
					break;
				case 'getSettings':
					this.sendMessage({
						command: 'getSettings',
						... await this.dataSource.getRepoSettings(msg.repo)
					});
					break;
				case 'loadBranches':
					let branchData = await this.dataSource.getBranches(msg.repo, msg.showRemoteBranches), isRepo = true;
					if (branchData.error) {
						// If an error occurred, check to make sure the repo still exists
						isRepo = (await this.dataSource.repoRoot(msg.repo)) !== null;
						if (!isRepo) branchData.error = null; // If the error is caused by the repo no longer existing, clear the error message
					}
					this.sendMessage({
						command: 'loadBranches',
						branches: branchData.branches,
						head: branchData.head,
						hard: msg.hard,
						isRepo: isRepo,
						error: branchData.error
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
						... await this.dataSource.getCommits(msg.repo, msg.branches, msg.maxCommits, msg.showRemoteBranches),
						hard: msg.hard
					});
					break;
				case 'loadRepos':
					if (!msg.check || !await this.repoManager.checkReposExist()) {
						// If not required to check repos, or no changes were found when checking, respond with repos
						this.respondLoadRepos(this.repoManager.getRepos(), null);
					}
					break;
				case 'merge':
					this.sendMessage({
						command: 'merge', type: msg.type,
						error: await this.dataSource.merge(msg.repo, msg.obj, msg.type, msg.createNewCommit, msg.squash)
					});
					break;
				case 'openFile':
					this.sendMessage({
						command: 'openFile',
						error: await openFile(msg.repo, msg.filePath)
					});
					break;
				case 'pruneRemote':
					this.sendMessage({
						command: 'pruneRemote',
						error: await this.dataSource.pruneRemote(msg.repo, msg.name)
					});
					break;
				case 'pullBranch':
					this.sendMessage({
						command: 'pullBranch',
						error: await this.dataSource.pullBranch(msg.repo, msg.branchName, msg.remote, msg.createNewCommit, msg.squash)
					});
					break;
				case 'pushBranch':
					this.sendMessage({
						command: 'pushBranch',
						error: await this.dataSource.pushBranch(msg.repo, msg.branchName, msg.remote, msg.setUpstream, msg.force)
					});
					break;
				case 'pushTag':
					this.sendMessage({
						command: 'pushTag',
						error: await this.dataSource.pushTag(msg.repo, msg.tagName, msg.remote)
					});
					break;
				case 'rebase':
					this.sendMessage({
						command: 'rebase', type: msg.type, interactive: msg.interactive,
						error: await this.dataSource.rebase(msg.repo, msg.obj, msg.type, msg.ignoreDate, msg.interactive)
					});
					break;
				case 'renameBranch':
					this.sendMessage({
						command: 'renameBranch',
						error: await this.dataSource.renameBranch(msg.repo, msg.oldName, msg.newName)
					});
					break;
				case 'rescanForRepos':
					if (!(await this.repoManager.searchWorkspaceForRepos())) {
						vscode.window.showErrorMessage('No Git repositories were found in the current workspace.');
					}
					break;
				case 'resetToCommit':
					this.sendMessage({
						command: 'resetToCommit',
						error: await this.dataSource.resetToCommit(msg.repo, msg.commitHash, msg.resetMode)
					});
					break;
				case 'revertCommit':
					this.sendMessage({
						command: 'revertCommit',
						error: await this.dataSource.revertCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					break;
				case 'saveRepoState':
					this.repoManager.setRepoState(msg.repo, msg.state);
					break;
				case 'startCodeReview':
					this.sendMessage({
						command: 'startCodeReview',
						codeReview: this.extensionState.startCodeReview(msg.repo, msg.id, msg.files, msg.lastViewedFile),
						commitHash: msg.commitHash,
						compareWithHash: msg.compareWithHash,
						success: true
					});
					break;
				case 'tagDetails':
					this.sendMessage({
						command: 'tagDetails',
						tagName: msg.tagName,
						commitHash: msg.commitHash,
						... await this.dataSource.getTagDetails(msg.repo, msg.tagName)
					});
					break;
				case 'viewDiff':
					this.sendMessage({
						command: 'viewDiff',
						success: await viewDiff(msg.repo, msg.fromHash, msg.toHash, msg.oldFilePath, msg.newFilePath, msg.type)
					});
					break;
				case 'viewScm':
					this.sendMessage({
						command: 'viewScm',
						success: await viewScm()
					});
					break;
			}
			this.repoFileWatcher.unmute();
		}, null, this.disposables);

		this.logger.log('Created Git Graph View');
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
		this.logger.log('Disposed Git Graph View');
	}

	private update() {
		this.panel.webview.html = this.getHtmlForWebview();
	}

	private getHtmlForWebview() {
		const config = getConfig(), nonce = getNonce();
		const viewState: GitGraphViewState = {
			autoCenterCommitDetailsView: config.autoCenterCommitDetailsView(),
			combineLocalAndRemoteBranchLabels: config.combineLocalAndRemoteBranchLabels(),
			commitDetailsViewLocation: config.commitDetailsViewLocation(),
			customBranchGlobPatterns: config.customBranchGlobPatterns(),
			customEmojiShortcodeMappings: config.customEmojiShortcodeMappings(),
			dateFormat: config.dateFormat(),
			defaultColumnVisibility: config.defaultColumnVisibility(),
			dialogDefaults: config.dialogDefaults(),
			fetchAndPrune: config.fetchAndPrune(),
			fetchAvatars: config.fetchAvatars() && this.extensionState.isAvatarStorageAvailable(),
			graphColours: config.graphColours(),
			graphStyle: config.graphStyle(),
			initialLoadCommits: config.initialLoadCommits(),
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadMoreCommits: config.loadMoreCommits(),
			loadRepo: this.loadRepo,
			muteMergeCommits: config.muteMergeCommits(),
			refLabelAlignment: config.refLabelAlignment(),
			repos: this.repoManager.getRepos(),
			showCurrentBranchByDefault: config.showCurrentBranchByDefault()
		};

		let body, numRepos = Object.keys(viewState.repos).length, colorVars = '', colorParams = '';
		for (let i = 0; i < viewState.graphColours.length; i++) {
			colorVars += '--git-graph-color' + i + ':' + viewState.graphColours[i] + '; ';
			colorParams += '[data-color="' + i + '"]{--git-graph-color:var(--git-graph-color' + i + ');} ';
		}

		if (this.dataSource.isGitExecutableUnknown()) {
			body = `<body class="unableToLoad" style="${colorVars}">
			<h2>Unable to load Git Graph</h2>
			<p class="unableToLoadMessage">${UNABLE_TO_FIND_GIT_MSG}</p>
			</body>`;
		} else if (numRepos > 0) {
			body = `<body style="${colorVars}">
			<div id="view">
				<div id="controls">
					<span id="repoControl"><span class="unselectable">Repo: </span><div id="repoSelect" class="dropdown"></div></span>
					<span id="branchControl"><span class="unselectable">Branches: </span><div id="branchSelect" class="dropdown"></div></span>
					<label id="showRemoteBranchesControl"><input type="checkbox" id="showRemoteBranchesCheckbox">Show Remote Branches</label>
					<div id="findBtn" title="Find"></div>
					<div id="settingsBtn" title="Repository Settings"></div>
					<div id="fetchBtn"></div>
					<div id="refreshBtn"></div>
				</div>
				<div id="content">
					<div id="commitGraph"></div>
					<div id="commitTable"></div>
				</div>
				<div id="footer"></div>
			</div>
			<div id="scrollShadow"></div>
			<script nonce="${nonce}">var viewState = ${JSON.stringify(viewState)};</script>
			<script src="${this.getMediaUri('out.min.js')}"></script>
			</body>`;
		} else {
			body = `<body class="unableToLoad" style="${colorVars}">
			<h2>Unable to load Git Graph</h2>
			<p class="unableToLoadMessage">No Git repositories were found in the current workspace when it was last scanned by Git Graph.</p>
			<p>If your repositories are in subfolders of the open workspace folder(s), make sure you have set the Git Graph Setting "git-graph.maxDepthOfRepoSearch" appropriately (read the <a href="https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings#max-depth-of-repo-search" target="_blank">documentation</a> for more information).</p>
			<p><div id="rescanForReposBtn" class="roundedBtn">Re-scan the current workspace for repositories</div></p>
			<script nonce="${nonce}">(function(){ var api = acquireVsCodeApi(); document.getElementById('rescanForReposBtn').addEventListener('click', function(){ api.postMessage({command: 'rescanForRepos'}); }); })();</script>
			</body>`;
		}
		this.isGraphViewLoaded = numRepos > 0;
		this.loadRepo = null;

		return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline'; script-src vscode-resource: 'nonce-${nonce}'; img-src data:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('out.min.css')}">
				<title>Git Graph</title>
				<style>${colorParams}</style>
			</head>
			${body}
		</html>`;
	}

	private getMediaUri(file: string) {
		return this.getUri('media', file).with({ scheme: 'vscode-resource' });
	}

	private getUri(...pathComps: string[]) {
		return vscode.Uri.file(path.join(this.extensionPath, ...pathComps));
	}

	private respondLoadRepos(repos: GitRepoSet, loadRepo: string | null) {
		this.sendMessage({
			command: 'loadRepos',
			repos: repos,
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadRepo: loadRepo
		});
	}
}