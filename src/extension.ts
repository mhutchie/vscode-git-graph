import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { getPathFromUri, isPathInWorkspace } from './utils';

export function activate(context: vscode.ExtensionContext) {
	const extensionState = new ExtensionState(context);
	const dataSource = new DataSource(context);
	const avatarManager = new AvatarManager(dataSource, extensionState);
	const statusBarItem = new StatusBarItem(context);
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', args => {
			let loadRepo: string | null = null;

			if (typeof args === 'object' && args.rootUri) {
				// If command is run from the SCP menu, load the specific repo
				loadRepo = getPathFromUri(args.rootUri);
				if (!repoManager.isKnownRepo(loadRepo)) {
					repoManager.registerRepo(loadRepo, true, true).then(valid => {
						if (!valid) loadRepo = null;
						GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, loadRepo);
					});
					return;
				}
			} else if (getConfig().openToTheRepoOfTheActiveTextEditorDocument() && vscode.window.activeTextEditor) {
				// If the config setting is enabled, load the repo containing the active text editor document
				loadRepo = repoManager.getRepoContainingFile(getPathFromUri(vscode.window.activeTextEditor.document.uri));
			}

			GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, loadRepo);
		}),
		vscode.commands.registerCommand('git-graph.addGitRepository', () => {
			vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(uris => {
				if (uris && uris.length > 0) {
					let path = getPathFromUri(uris[0]);
					let folderName = path.substr(path.lastIndexOf('/') + 1);
					if (isPathInWorkspace(path)) {
						repoManager.registerRepo(path, false, false).then(valid => {
							if (valid) {
								vscode.window.showInformationMessage('The repository "' + folderName + '" was added to Git Graph.');
							} else {
								vscode.window.showErrorMessage('The folder "' + folderName + '" is not a Git repository, and therefore could not be added to Git Graph.');
							}
						});
					} else {
						vscode.window.showErrorMessage('The folder "' + folderName + '" is not within the opened Visual Studio Code workspace, and therefore could not be added to Git Graph.');
					}
				}
			});
		}),
		vscode.commands.registerCommand('git-graph.clearAvatarCache', () => {
			avatarManager.clearCache();
		}),
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			} else if (e.affectsConfiguration('git-graph.dateType')) {
				dataSource.generateGitCommandFormats();
			} else if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			} else if (e.affectsConfiguration('git.path')) {
				dataSource.registerGitPath();
			}
		}),
		repoManager
	);
}

export function deactivate() { }
