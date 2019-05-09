import * as vscode from 'vscode';
import { getPathFromUri } from './utils';

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
		this.fsWatcher = vscode.workspace.createFileSystemWatcher(repo + '/**');
		this.fsWatcher.onDidCreate(uri => this.refresh(uri));
		this.fsWatcher.onDidChange(uri => this.refresh(uri));
		this.fsWatcher.onDidDelete(uri => this.refresh(uri));
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

	private async refresh(uri: vscode.Uri) {
		if (this.muted) return;
		if (!getPathFromUri(uri).replace(this.repo + '/', '').match(fileChangeRegex)) return;
		if ((new Date()).getTime() < this.resumeAt) return;

		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.repoChangeCallback();
		}, 750);
	}
}
