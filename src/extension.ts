import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { StatusBarItem } from './statusBarItem';

export function activate(context: vscode.ExtensionContext) {
	const extensionState = new ExtensionState(context);
	const dataSource = new DataSource();
	const avatarManager = new AvatarManager(dataSource, extensionState);
	const statusBarItem = new StatusBarItem(context, dataSource);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', () => {
			GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager);
		}),
		vscode.commands.registerCommand('git-graph.clearAvatarCache', () => {
			avatarManager.clearCache();
		})
	);

	context.subscriptions.push(vscode.Disposable.from(
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource))
	));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
			statusBarItem.refresh();
		} else if (e.affectsConfiguration('git-graph.dateType')) {
			dataSource.generateGitCommandFormats();
		} else if (e.affectsConfiguration('git.path')) {
			dataSource.registerGitPath();
		}
	}));
}

export function deactivate() { }
