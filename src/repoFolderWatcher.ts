import * as vscode from 'vscode';
import { DataSource } from './dataSource';

export class RepoFolderWatcher {
	private readonly repoChangeCallback: (repo: string[]) => void;
	private readonly dataSource: DataSource;
	private changeHandler: vscode.Disposable | null = null;

	constructor(dataSource: DataSource, repoChangeCallback: (repo: string[]) => void) {
		this.dataSource = dataSource;
		this.repoChangeCallback = repoChangeCallback;
		this.start();
	}

	public start() {
		if (this.changeHandler !== null) {
			this.stop();
		}

		this.changeHandler = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			let repos = await this.dataSource.getRepos();
			this.repoChangeCallback(repos);
		});
	}

	public stop() {
		if (this.changeHandler !== null) {
			this.changeHandler.dispose();
			this.changeHandler = null;
		}
	}
}
