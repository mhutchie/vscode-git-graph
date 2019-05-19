import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { getPathFromUri } from './utils';

export function activate(context: vscode.ExtensionContext) {
	const extensionState = new ExtensionState(context);
	const dataSource = new DataSource();
	const avatarManager = new AvatarManager(dataSource, extensionState);
	const statusBarItem = new StatusBarItem(context);
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', args => {
			let loadRepo = typeof args === 'object' && args.rootUri ? getPathFromUri(args.rootUri) : null;
			if (loadRepo !== null && !repoManager.isKnownRepo(loadRepo)) {
				repoManager.registerRepo(loadRepo).then(valid => {
					if (!valid) loadRepo = null;
					GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, loadRepo);
				});
			} else {
				GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, loadRepo);
			}
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
