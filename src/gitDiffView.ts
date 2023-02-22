import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, toDisposable } from './utils/disposable';
import { execShell, getNonce } from './utils';
/**
 * Manages the Git Graph View.
 */
export class GitDiffView extends Disposable {
	public static currentPanel: GitDiffView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private isPanelVisible: boolean = true;
	private gitCmd: string;
	private logger = vscode.window.createOutputChannel('gitDiffBySW');
	private repoPath: string;
	private filePath: string;
	private escapedStr = '<';

	public static createOrShow(
		extensionPath: string,
		gitCmd: string,
		filePath: string,
		column: vscode.ViewColumn = vscode.ViewColumn.Beside
	) {
		if (GitDiffView.currentPanel) {
			GitDiffView.currentPanel.panel.reveal(column);
			GitDiffView.currentPanel.gitCmd = gitCmd;
			GitDiffView.currentPanel.filePath = filePath;
			GitDiffView.currentPanel.refreshViewContent();
		} else {
			// If Git Graph panel doesn't already exist
			GitDiffView.currentPanel = new GitDiffView(
				extensionPath,
				gitCmd,
				filePath,
				column
			);
		}
	}

	private constructor(
		extensionPath: string,
		gitCmd: string,
		filePath: string,
		column: vscode.ViewColumn
	) {
		super();
		this.gitCmd = gitCmd;
		this.extensionPath = extensionPath;
		this.panel = vscode.window.createWebviewPanel(
			'Diff Viewer',
			'Diff Viewer',
			column,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(extensionPath, 'media')),
					vscode.Uri.file(path.join(extensionPath, 'resources'))
				]
			}
		);
		this.filePath = filePath;
		this.refreshViewContent();
		this.repoPath =
			vscode.workspace &&
			vscode.workspace.workspaceFolders &&
			vscode.workspace.workspaceFolders[0]
				? vscode.workspace.workspaceFolders[0].uri.fsPath
				: '';

		// refresh diff view when file changed
		vscode.workspace.onDidSaveTextDocument(async ({ uri }) => {
			// This filePath may be full path or relative path
			if (uri.path && uri.path.endsWith(this.filePath)) {
				this.logger.appendLine(
					'<<<refreshViewContent>>>  ' + this.filePath
				);
				this.refreshViewContent();
			} else if (this.filePath === '.') {
				this.logger.appendLine(
					'<<<refreshViewContent>>> for current repository.'
				);
				this.refreshViewContent();
			}
		});

		this.registerDisposables(
			// Dispose Git Graph View resources when disposed
			toDisposable(() => {
				GitDiffView.currentPanel = undefined;
			}),

			// Dispose this Git Graph View when the Webview Panel is disposed
			this.panel.onDidDispose(() => this.dispose()),

			// Register a callback that is called when the view is shown or hidden
			this.panel.onDidChangeViewState(() => {
				if (this.panel.visible !== this.isPanelVisible) {
					this.isPanelVisible = this.panel.visible;
				}
			}),
			// Dispose the Webview Panel when disposed
			this.panel
		);

		this.panel.webview.onDidReceiveMessage((message) => {
			switch (message.command) {
				case 'showErrorMessage':
					vscode.window.showErrorMessage(message.message);
					return;
				case 'showMessage':
					vscode.window.showInformationMessage(message.message);
					return;
				case 'openFile':
					if (message.fileState !== 'D') {
						this.openFile(message.fileRelativePath);
					} else {
						vscode.window.showErrorMessage(
							'The file has been deleted'
						);
					}
					return;
				case 'revertFile':
					this.revertFile(message.fileRelativePath, true);
					return;
				case 'copeFilePath':
					this.copyFilePath(message.fileRelativePath);
					return;
				case 'refresh':
					this.refreshViewContent();
					return;
			}
		}, undefined);
	}

	private copyFilePath(path: string) {
		// TODO doesn't work
		const filePath = this.getAbsolutePath(path);
		vscode.env.clipboard.writeText(filePath);
	}

	private openFile(path: string) {
		const filePath = vscode.Uri.file(this.getAbsolutePath(path));
		vscode.workspace.openTextDocument(filePath).then((doc) => {
			vscode.window.showTextDocument(doc);
		});
	}

	private revertFile(path: string, withWarning: boolean) {
		const filePath = this.getAbsolutePath(path);
		const revertFileAction = () => {
			const cmd = 'cd ' + this.repoPath + '; git restore ' + filePath;
			execShell(cmd).then(
				(stdout) => {
					this.logger.appendLine(
						'file reverted' + stdout + withWarning
					);
					this.refreshViewContent();
				},
				(error) => {
					vscode.window.showErrorMessage(error);
				}
			);
		};
		if (withWarning) {
			vscode.window
				.showInformationMessage(
					'Do you want to revert selected file?' + path,
					'Yes',
					'No'
				)
				.then((answer) => {
					if (answer === 'Yes') {
						revertFileAction();
					}
				});
		} else {
			revertFileAction();
		}
	}

	private getAbsolutePath(path: string) {
		return this.repoPath + '/' + path;
	}

	private refreshViewContent() {
		execShell(this.gitCmd).then((stdout) => {
			this.panel.webview.html = this.getHtmlForWebview(stdout);
			this.logger.appendLine('content refreshed');
		});
	}
	/**
	 * Get the HTML document to be loaded in the Webview.
	 * https://cdnjs.com/libraries/highlight.js
	 * @returns The HTML.
	 */
	private getHtmlForWebview(diffContent: string): string {
		const nonce = getNonce();
		this.logger.appendLine(`handle ${this.escapedStr} automatically`);
		return /* html */ `
		<!DOCTYPE html>
		<html lang="en" id="diff-2-html">
		<head>
			<title></title>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
			<link rel="stylesheet" type="text/css" href="${this.getMediaUri('out.min.css')}">
			<link rel="stylesheet" href="${this.getResourcesUri('highlight_11.6.0_github.min.css')}" />
			<link rel="stylesheet" type="text/css" href="${this.getResourcesUri('diff2html.min.css')}" />
			<style>
				.custom-git-btn{
					margin-right:5px;
					margin-left:2px;
					height:15px;
					font-size:8px;
				}
			</style>
			<script type="text/javascript" src="${this.getResourcesUri('diff2html-ui.min.js')}"></script>
			<script src="${this.getResourcesUri('jquery.min.js')}"></script>
			<script nonce="${nonce}">
				const _vscodeApi = acquireVsCodeApi();
				let escapedStr = '${this.escapedStr}'
				jQuery(function() {
					jQuery('#git-diff-body').on('click','.custom-git-btn',function(evt){
						_vscodeApi.postMessage(jQuery(this).data());
					});
					const diffContent = \`${this.getEscapedDiffContent(diffContent)}\`;
					const configuration = {
						drawFileList: true,
						fileListToggle: true,
						fileListStartVisible: false,
						fileContentToggle: true,
						matching: 'lines',
						outputFormat: 'line-by-line',
						synchronisedScroll: true,
						highlight: true,
						renderNothingWhenEmpty: false,
					};

					const diff2htmlUi = new Diff2HtmlUI(jQuery('#app')[0], diffContent, configuration);
					diff2htmlUi.draw();
					diff2htmlUi.highlightCode();

					jQuery('.d2h-file-name-wrapper').each(function(){
						const relativeFilePath = jQuery(this).find('.d2h-file-name').html();
						var fileState = '';

						if(jQuery(this).find('.d2h-deleted').length){
							fileState = 'D';
						}else if(jQuery(this).find('.d2h-changed').length){
							fileState = 'C'
						}else if(jQuery(this).find('.d2h-added').length){
							fileState = 'A'
						}

						jQuery(this).prepend('<button class="custom-git-btn" data-command="openFile" title="open file" data-file-relative-path="'+relativeFilePath+'" data-file-state = "'+fileState+'" >O</button>');
						jQuery(this).prepend('<button class="custom-git-btn" data-command="revertFile" title="revert file" data-file-relative-path="'+relativeFilePath+'" data-file-state = "'+fileState+'" >R</button>');
					});

				});
			</script>
		</head>
		<body style="position:inherit" id="git-diff-body">
			<div>
				<button class="custom-git-btn" data-command="refresh">Refresh</button>
			</div>
			<div id="app"></div>
			<div>
				<hr/><br/>
				<b>The cmd use to generate this is:</b><br/>
				${this.gitCmd};
			</div>
		</body>
		</html>`;
	}

	private getEscapedDiffContent(diff:string):string {
		diff = diff.replace(/[\\`\$]/g, '\\$&');
		diff = diff.replace(/</g, '${escapedStr}');
		return diff;
	}
	/* URI Manipulation Methods */
	private getMediaUri(file: string) {
		return this.panel.webview.asWebviewUri(this.getUri('media', file));
	}

	private getResourcesUri(file: string) {
		return this.panel.webview.asWebviewUri(this.getUri('resources', file));
	}

	private getUri(...pathComps: string[]) {
		return vscode.Uri.file(path.join(this.extensionPath, ...pathComps));
	}
}
