import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource } from './dataSource';

export class StatusBarItem {
	private dataSource: DataSource;
	private statusBarItem: vscode.StatusBarItem;

	constructor(context: vscode.ExtensionContext, dataSource: DataSource) {
		this.dataSource = dataSource;
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
		this.statusBarItem.text = 'Git Graph';
		this.statusBarItem.tooltip = 'View Git Graph';
		this.statusBarItem.command = 'git-graph.view';
		context.subscriptions.push(this.statusBarItem);
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			this.refresh();
		}));
		this.refresh();
	}

	public async refresh() {
		if (getConfig().showStatusBarItem() && Object.keys(await this.dataSource.getRepos()).length > 0) {
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}
}