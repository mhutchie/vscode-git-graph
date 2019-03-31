import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { StatusBarItem } from './statusBarItem';

export function activate(context: vscode.ExtensionContext) {
	const extensionState = new ExtensionState(context);
	const dataSource = new DataSource();
	const statusBarItem = new StatusBarItem(context, dataSource);

	context.subscriptions.push(vscode.commands.registerCommand('git-graph.view', () => {
		GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState);
	}));

	context.subscriptions.push(vscode.Disposable.from(
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource))
	));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
			statusBarItem.refresh();
		} else if (e.affectsConfiguration('git.path')) {
			dataSource.registerGitPath();
		}
	}));
}

export function deactivate() { }
