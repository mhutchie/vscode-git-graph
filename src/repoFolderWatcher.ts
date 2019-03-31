import * as vscode from 'vscode';

export class RepoFolderWatcher {
	private readonly repoChangeCallback: () => void;
	private changeHandler: vscode.Disposable | null = null;

	constructor(repoChangeCallback: () => void) {
		this.repoChangeCallback = repoChangeCallback;
		this.start();
	}

	public start() {
		if (this.changeHandler !== null) {
			this.stop();
		}

		this.changeHandler = vscode.workspace.onDidChangeWorkspaceFolders(() => {
			this.repoChangeCallback();
		});
	}

	public stop() {
		if (this.changeHandler !== null) {
			this.changeHandler.dispose();
			this.changeHandler = null;
		}
	}
}
