import * as vscode from 'vscode';

const fileChangeRegex = /(^\.git\/(config|index|HEAD|refs\/stash|refs\/heads\/.*|refs\/remotes\/.*|refs\/tags\/.*)$)|(^(?!\.git).*$)|(^\.git[^\/]+$)/;

export class RepoFileWatcher {
	private repo: string | null = null;
	private readonly repoChangeCallback: () => void;
	private fsWatcher: vscode.FileSystemWatcher | null = null;
	private refreshTimeout: NodeJS.Timer | null = null;
	private muted: boolean = false;
	private resumeAt: number = 0;

	constructor(repoChangeCallback: () => void) {
		this.repoChangeCallback = repoChangeCallback;
	}

	public start(repo: string) {
		if (this.fsWatcher !== null) {
			this.stop();
		}

		this.repo = repo;
		let ws = vscode.workspace.workspaceFolders!.find(f => f.uri.fsPath.replace(/\\/g, '/') === repo)!;
		this.fsWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(ws, '**'));
		this.fsWatcher.onDidCreate(uri => this.refesh(uri));
		this.fsWatcher.onDidChange(uri => this.refesh(uri));
		this.fsWatcher.onDidDelete(uri => this.refesh(uri));
	}

	public stop() {
		if (this.fsWatcher !== null) {
			this.fsWatcher.dispose();
			this.fsWatcher = null;
		}
	}

	public mute() {
		this.muted = true;
	}

	public unmute() {
		this.muted = false;
		this.resumeAt = (new Date()).getTime() + 1500;
	}

	private async refesh(uri: vscode.Uri) {
		if (this.muted) return;
		if (!uri.fsPath.replace(/\\/g, '/').replace(this.repo + '/', '').match(fileChangeRegex)) return;
		if ((new Date()).getTime() < this.resumeAt) return;

		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.repoChangeCallback();
		}, 750);
	}
}
