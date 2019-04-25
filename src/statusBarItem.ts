import * as vscode from 'vscode';
import { getConfig } from './config';

export class StatusBarItem {
	private statusBarItem: vscode.StatusBarItem;
	private numRepos: number = 0;

	constructor(context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
		this.statusBarItem.text = 'Git Graph';
		this.statusBarItem.tooltip = 'View Git Graph';
		this.statusBarItem.command = 'git-graph.view';
		context.subscriptions.push(this.statusBarItem);
	}

	public setNumRepos(numRepos: number) {
		this.numRepos = numRepos;
		this.refresh();
	}

	public refresh() {
		if (getConfig().showStatusBarItem() && this.numRepos > 0) {
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}
}