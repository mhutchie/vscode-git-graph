import * as path from 'path';
import * as vscode from 'vscode';
import { Config } from './config';
import { DataSource } from './dataSource';
import { encodeDiffDocUri } from './diffDocProvider';
import { GitFileChangeType, GitGraphViewSettings, RequestMessage, ResponseMessage } from './types';
import { abbrevCommit } from './utils';

export class GitGraphView {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private readonly dataSource: DataSource | null;
	private disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string, dataSource: DataSource | null) {
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

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, dataSource: DataSource | null) {
		this.panel = panel;
		this.extensionPath = extensionPath;
		this.dataSource = dataSource;

		this.update();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.onDidChangeViewState(e => {
			if (this.panel.visible) {
				this.update();
			}
		}, null, this.disposables);

		this.panel.webview.onDidReceiveMessage(async (message: RequestMessage) => {
			if (this.dataSource === null) return;
			switch (message.command) {
				case 'loadBranches':
					this.sendMessage({
						command: 'loadBranches',
						data: this.dataSource.getBranches(message.data.showRemoteBranches)
					});
					return;
				case 'loadCommits':
					this.sendMessage({
						command: 'loadCommits',
						data: this.dataSource.getCommits(message.data.branch, message.data.maxCommits, message.data.showRemoteBranches, message.data.currentBranch)
					});
					return;
				case 'addTag':
					this.sendMessage({
						command: 'addTag',
						data: this.dataSource.addTag(message.data.tagName, message.data.commitHash)
					});
					return;
				case 'deleteTag':
					this.sendMessage({
						command: 'deleteTag',
						data: this.dataSource.deleteTag(message.data)
					});
					return;
				case 'copyCommitHashToClipboard':
					this.copyCommitHashToClipboard(message.data);
					return;
				case 'createBranch':
					this.sendMessage({
						command: 'createBranch',
						data: this.dataSource.createBranch(message.data.branchName, message.data.commitHash)
					});
					return;
				case 'checkoutBranch':
					this.sendMessage({
						command: 'checkoutBranch',
						data: this.dataSource.checkoutBranch(message.data.branchName, message.data.remoteBranch)
					});
					return;
				case 'deleteBranch':
					this.sendMessage({
						command: 'deleteBranch',
						data: this.dataSource.deleteBranch(message.data.branchName, message.data.forceDelete)
					});
					return;
				case 'renameBranch':
					this.sendMessage({
						command: 'renameBranch',
						data: this.dataSource.renameBranch(message.data.oldName, message.data.newName)
					});
					return;
				case 'resetToCommit':
					this.sendMessage({
						command: 'resetToCommit',
						data: this.dataSource.resetToCommit(message.data.commitHash, message.data.resetMode)
					});
					return;
				case 'commitDetails':
					this.sendMessage({
						command: 'commitDetails',
						data: this.dataSource.commitDetails(message.data)
					});
					return;
				case 'viewDiff':
					this.viewDiff(message.data.commitHash, message.data.oldFilePath, message.data.newFilePath, message.data.type);
					return;
			}
		}, null, this.disposables);
	}

	public dispose() {
		GitGraphView.currentPanel = undefined;
		this.panel.dispose();
		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private update() {
		this.panel.webview.html = this.getHtmlForWebview();
	}

	private getHtmlForWebview() {
		const config = new Config();
		const jsPathOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'main.js'));
		const jsUri = jsPathOnDisk.with({ scheme: 'vscode-resource' });
		const cssPathOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'main.css'));
		const cssUri = cssPathOnDisk.with({ scheme: 'vscode-resource' });
		const isRepo = this.dataSource !== null && this.dataSource.isGitRepository();
		const nonce = getNonce();

		let settings: GitGraphViewSettings = {
			graphStyle: config.graphStyle(),
			initialLoadCommits: config.initialLoadCommits(),
			loadMoreCommits: config.loadMoreCommits(),
			graphColours: config.graphColours(),
			dateFormat: config.dateFormat()
		};

		let colourStyles = '';
		for (let i = 0; i < settings.graphColours.length; i++) {
			colourStyles += '.colour' + i + ' { background-color:' + settings.graphColours[i] + '; } ';
		}

		let html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'nonce-${nonce}'; script-src vscode-resource: 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${cssUri}">
				<title>Git Graph</title>
				<style nonce="${nonce}">${colourStyles}</style>
            </head>`;
		if (isRepo) {
			html += `<body>
			<div id="controls">
				<span class="unselectable">Branch: </span><select id="branchSelect"></select>
				<label><input type="checkbox" id="showRemoteBranchesCheckbox" value="1" checked>Show Remote Branches</label>
				<div id="refreshBtn" class="roundedBtn">Refresh</div>
			</div>
			<div id="commitGraph"></div>
			<div id="commitTable"></div>
			<ul id="contextMenu"></ul>
			<div id="dialogBacking"></div>
			<div id="dialog"></div>
			<script nonce="${nonce}">var settings = ${JSON.stringify(settings)};</script>
			<script src="${jsUri}"></script>
			</body>`;
		} else {
			html += `<body class="notGitRepository"><h1>Git Graph</h1><p>The current workspace is not a Git Repository, unable to show Git Graph.</p></body>`;
		}
		html += `</html>`;
		return html;
	}

	private sendMessage(msg: ResponseMessage) {
		this.panel.webview.postMessage(msg);
	}

	private copyCommitHashToClipboard(str: string) {
		vscode.env.clipboard.writeText(str).then(
			() => this.sendMessage({ command: 'copyCommitHashToClipboard', data: true }),
			() => this.sendMessage({ command: 'copyCommitHashToClipboard', data: false })
		);
	}

	private viewDiff(commitHash: string, oldFilePath: string, newFilePath: string, type: GitFileChangeType) {
		let abbrevHash = abbrevCommit(commitHash);
		let pathComponents = newFilePath.split('/');
		let title = pathComponents[pathComponents.length - 1] + ' (' + (type === 'A' ? 'Added in ' + abbrevHash : type === 'D' ? 'Deleted in ' + abbrevHash : abbrevCommit(commitHash) + '^ ↔ ' + abbrevCommit(commitHash)) + ')';
		vscode.commands.executeCommand('vscode.diff', encodeDiffDocUri(oldFilePath, commitHash + '^'), encodeDiffDocUri(newFilePath, commitHash), title, { preview: true });
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