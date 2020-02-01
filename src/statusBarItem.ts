import * as vscode from 'vscode';
import { getConfig } from './config';
import { Logger } from './logger';
import { RepoManager } from './repoManager';

/**
 * Manages the Git Graph Status Bar Item, which allows users to open the Git Graph View from the Visual Studio Code Status Bar.
 */
export class StatusBarItem implements vscode.Disposable {
	private readonly logger: Logger;
	private readonly statusBarItem: vscode.StatusBarItem;
	private isVisible: boolean = false;
	private numRepos: number = 0;
	private disposables: vscode.Disposable[] = [];

	/**
	 * Creates the Git Graph Status Bar Item.
	 * @param repoManager The Git Graph RepoManager instance.
	 * @param logger The Git Graph Logger instance.
	 */
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

	/**
	 * Disposes the resources used by the StatusBarItem.
	 */
	public dispose() {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables = [];
	}

	/** 
	 * Sets the number of repositories known to Git Graph, before refreshing the Status Bar Item.
	 * @param numRepos The number of repositories known to Git Graph.
	 */
	private setNumRepos(numRepos: number) {
		this.numRepos = numRepos;
		this.refresh();
	}

	/** 
	 * Show or hide the Status Bar Item according to the configured value of `git-graph.showStatusBarItem`, and the number of repositories known to Git Graph.
	 */
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