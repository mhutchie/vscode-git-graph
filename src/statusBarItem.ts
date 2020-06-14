import * as vscode from 'vscode';
import { getConfig } from './config';
import { Event } from './event';
import { Logger } from './logger';
import { RepoChangeEvent } from './repoManager';

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
	constructor(initialNumRepos: number, onDidChangeRepos: Event<RepoChangeEvent>, onDidChangeConfiguration: Event<vscode.ConfigurationChangeEvent>, logger: Logger) {
		this.logger = logger;

		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
		statusBarItem.text = 'Git Graph';
		statusBarItem.tooltip = 'View Git Graph';
		statusBarItem.command = 'git-graph.view';
		this.statusBarItem = statusBarItem;
		this.disposables.push(statusBarItem);

		onDidChangeRepos((event) => {
			this.setNumRepos(event.numRepos);
		}, this.disposables);

		onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('git-graph.showStatusBarItem')) {
				this.refresh();
			}
		}, this.disposables);

		this.setNumRepos(initialNumRepos);
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
	private refresh() {
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