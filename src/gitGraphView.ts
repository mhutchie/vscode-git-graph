import * as path from 'path';
import * as vscode from 'vscode';
import { Config } from './config';
import { DataSource } from './dataSource';
import { encodeDiffDocUri } from './diffDocProvider';
import { GitFileChangeType, GitGraphViewSettings, RequestMessage, ResponseMessage } from './types';
import { abbrevCommit, copyToClipboard } from './utils';

export class GitGraphView {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private readonly dataSource: DataSource;
	private disposables: vscode.Disposable[] = [];
	private changeWorkspaceFolderHandler: vscode.Disposable | null = null;
	private isGraphViewLoaded: boolean = false;

	public static createOrShow(extensionPath: string, dataSource: DataSource) {
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

		GitGraphView.currentPanel = new GitGraphView(panel, extensionPath, dataSource);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, dataSource: DataSource) {
		this.panel = panel;
		this.extensionPath = extensionPath;
		this.dataSource = dataSource;

		this.update();
		this.startMonitoringWorkspaceFolders();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.onDidChangeViewState(e => {
			if (this.panel.visible) {
				this.update();
				this.startMonitoringWorkspaceFolders();
			} else {
				this.stopMonitoringWorkspaceFolders();
			}
		}, null, this.disposables);

		this.panel.webview.onDidReceiveMessage(async (msg: RequestMessage) => {
			if (this.dataSource === null) return;
			switch (msg.command) {
				case 'addTag':
					this.sendMessage({
						command: 'addTag',
						status: await this.dataSource.addTag(msg.repo, msg.tagName, msg.commitHash)
					});
					return;
				case 'checkoutBranch':
					this.sendMessage({
						command: 'checkoutBranch',
						status: await this.dataSource.checkoutBranch(msg.repo, msg.branchName, msg.remoteBranch)
					});
					return;
				case 'cherrypickCommit':
					this.sendMessage({
						command: 'cherrypickCommit',
						status: await this.dataSource.cherrypickCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					return;
				case 'commitDetails':
					this.sendMessage({
						command: 'commitDetails',
						commitDetails: await this.dataSource.commitDetails(msg.repo, msg.commitHash)
					});
					return;
				case 'copyCommitHashToClipboard':
					this.sendMessage({
						command: 'copyCommitHashToClipboard',
						success: await copyToClipboard(msg.commitHash)
					});
					return;
				case 'createBranch':
					this.sendMessage({
						command: 'createBranch',
						status: await this.dataSource.createBranch(msg.repo, msg.branchName, msg.commitHash)
					});
					return;
				case 'deleteBranch':
					this.sendMessage({
						command: 'deleteBranch',
						status: await this.dataSource.deleteBranch(msg.repo, msg.branchName, msg.forceDelete)
					});
					return;
				case 'deleteTag':
					this.sendMessage({
						command: 'deleteTag',
						status: await this.dataSource.deleteTag(msg.repo, msg.tagName)
					});
					return;
				case 'loadBranches':
					this.sendMessage({
						command: 'loadBranches',
						... await this.dataSource.getBranches(msg.repo, msg.showRemoteBranches)
					});
					return;
				case 'loadCommits':
					this.sendMessage({
						command: 'loadCommits',
						... await this.dataSource.getCommits(msg.repo, msg.branchName, msg.maxCommits, msg.showRemoteBranches)
					});
					return;
				case 'loadRepos':
					this.sendMessage({
						command: 'loadRepos',
						repos: await this.dataSource.getRepos()
					});
					return;
				case 'mergeBranch':
					this.sendMessage({
						command: 'mergeBranch',
						status: await this.dataSource.mergeBranch(msg.repo, msg.branchName, msg.createNewCommit)
					});
					return;
				case 'renameBranch':
					this.sendMessage({
						command: 'renameBranch',
						status: await this.dataSource.renameBranch(msg.repo, msg.oldName, msg.newName)
					});
					return;
				case 'resetToCommit':
					this.sendMessage({
						command: 'resetToCommit',
						status: await this.dataSource.resetToCommit(msg.repo, msg.commitHash, msg.resetMode)
					});
					return;
				case 'revertCommit':
					this.sendMessage({
						command: 'revertCommit',
						status: await this.dataSource.revertCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					return;
				case 'viewDiff':
					this.sendMessage({
						command: 'viewDiff',
						success: await this.viewDiff(msg.repo, msg.commitHash, msg.oldFilePath, msg.newFilePath, msg.type)
					});
					return;
			}
		}, null, this.disposables);
	}

	public dispose() {
		GitGraphView.currentPanel = undefined;
		this.panel.dispose();
		this.stopMonitoringWorkspaceFolders();
		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async update() {
		this.panel.webview.html = await this.getHtmlForWebview();
	}

	private startMonitoringWorkspaceFolders() {
		this.changeWorkspaceFolderHandler = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			let repos = await this.dataSource.getRepos();
			if ((repos.length === 0 && this.isGraphViewLoaded) || (repos.length > 0 && !this.isGraphViewLoaded)) {
				this.update();
			} else {
				this.sendMessage({ command: 'loadRepos', repos: repos });
			}
		});
	}

	private stopMonitoringWorkspaceFolders() {
		if (this.changeWorkspaceFolderHandler !== null) this.changeWorkspaceFolderHandler.dispose();
	}

	private async getHtmlForWebview() {
		const config = new Config(), nonce = getNonce();

		let settings: GitGraphViewSettings = {
			autoCenterCommitDetailsView: config.autoCenterCommitDetailsView(),
			dateFormat: config.dateFormat(),
			graphColours: config.graphColours(),
			graphStyle: config.graphStyle(),
			initialLoadCommits: config.initialLoadCommits(),
			loadMoreCommits: config.loadMoreCommits(),
			repos: await this.dataSource.getRepos(),
			showCurrentBranchByDefault: config.showCurrentBranchByDefault()
		};

		let colourStyles = '', body;
		for (let i = 0; i < settings.graphColours.length; i++) {
			colourStyles += '.colour' + i + ' { background-color:' + settings.graphColours[i] + '; } ';
		}

		if (settings.repos.length > 0) {
			body = `<body>
			<div id="controls">
				<span id="repoControl"><span class="unselectable">Repo: </span><div id="repoSelect" class="dropdown"></div></span>
				<span id="branchControl"><span class="unselectable">Branch: </span><div id="branchSelect" class="dropdown"></div></span>
				<label id="showRemoteBranchesControl"><input type="checkbox" id="showRemoteBranchesCheckbox" value="1" checked>Show Remote Branches</label>
				<div id="refreshBtn" class="roundedBtn">Refresh</div>
			</div>
			<div id="content">
				<div id="commitGraph"></div>
				<div id="commitTable"></div>
			</div>
			<ul id="contextMenu"></ul>
			<div id="dialogBacking"></div>
			<div id="dialog"></div>
			<script nonce="${nonce}">var settings = ${JSON.stringify(settings)};</script>
			<script src="${this.getMediaUri('out.min.js')}"></script>
			</body>`;
		} else {
			body = `<body class="unableToLoad"><h1>Git Graph</h1><p>Unable to load Git Graph. Either the current workspace is not a Git Repository, or the Git executable could not found.</p></body>`;
		}
		this.isGraphViewLoaded = settings.repos.length > 0;

		return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline'; script-src vscode-resource: 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('main.css')}">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('dropdown.css')}">
				<title>Git Graph</title>
				<style>${colourStyles}</style>
			</head>
			${body}
		</html>`;
	}

	private getMediaUri(file: string) {
		return vscode.Uri.file(path.join(this.extensionPath, 'media', file)).with({ scheme: 'vscode-resource' });
	}

	private sendMessage(msg: ResponseMessage) {
		this.panel.webview.postMessage(msg);
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

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}