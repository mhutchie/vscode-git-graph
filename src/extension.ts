import * as vscode from 'vscode';
import { Config } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { GitGraphView } from './gitGraphView';

export function activate(context: vscode.ExtensionContext) {
	const dataSource = new DataSource();

	context.subscriptions.push(vscode.commands.registerCommand('git-graph.view', () => {
		GitGraphView.createOrShow(context.extensionPath, dataSource);
	}));

	context.subscriptions.push(vscode.Disposable.from(
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource))
	));

	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	statusBarItem.text = 'Git Graph';
	statusBarItem.tooltip = 'View Git Graph';
	statusBarItem.command = 'git-graph.view';
	context.subscriptions.push(statusBarItem);

	if ((new Config()).showStatusBarItem()) {
		statusBarItem.show();
	}
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
			if ((new Config()).showStatusBarItem()) {
				statusBarItem.show();
			} else {
				statusBarItem.hide();
			}
		} else if (e.affectsConfiguration('git.path') && dataSource !== null) {
			dataSource.registerGitPath();
		}
	}));
}

export function deactivate() { }
