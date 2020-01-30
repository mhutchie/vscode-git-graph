import * as vscode from 'vscode';
import { getConfig } from './config';
import { Logger } from './logger';
import { RepoManager } from './repoManager';

export class StatusBarItem implements vscode.Disposable {
	private readonly logger: Logger;
	private readonly statusBarItem: vscode.StatusBarItem;
	private isVisible: boolean = false;
	private numRepos: number = 0;
	private disposables: vscode.Disposable[] = [];

	constructor(repoManager: RepoManager, logger: Logger) {
		this.logger = logger;

		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
		statusBarItem.text = 'Git Graph';
		statusBarItem.tooltip = 'View Git Graph';
		statusBarItem.command = 'git-graph.view';
		this.statusBarItem = statusBarItem;
		this.disposables.push(statusBarItem);

		repoManager.onDidChangeRepos((event) => {
			this.setNumRepos(event.numRepos);
		}, this.disposables);

		this.setNumRepos(Object.keys(repoManager.getRepos()).length);
	}

	public dispose() {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables = [];
	}

	public setNumRepos(numRepos: number) {
		this.numRepos = numRepos;
		this.refresh();
	}

	public refresh() {
		const shouldBeVisible = getConfig().showStatusBarItem && this.numRepos > 0;
		if (this.isVisible !== shouldBeVisible) {
			if (shouldBeVisible) {
				this.statusBarItem.show();
				this.logger.log('Showing "Git Graph" Status Bar Item');
			} else {
				this.statusBarItem.hide();
				this.logger.log('Hiding "Git Graph" Status Bar Item');
			}
			this.isVisible = shouldBeVisible;
		}
	}
}