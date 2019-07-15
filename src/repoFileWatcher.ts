import * as vscode from 'vscode';
import { Logger } from './logger';
import { getPathFromUri } from './utils';

const FILE_CHANGE_REGEX = /(^\.git\/(config|index|HEAD|refs\/stash|refs\/heads\/.*|refs\/remotes\/.*|refs\/tags\/.*)$)|(^(?!\.git).*$)|(^\.git[^\/]+$)/;

export class RepoFileWatcher {
	private repo: string | null = null;
	private readonly logger: Logger;
	private readonly repoChangeCallback: () => void;
	private fsWatcher: vscode.FileSystemWatcher | null = null;
	private refreshTimeout: NodeJS.Timer | null = null;
	private muted: boolean = false;
	private resumeAt: number = 0;

	constructor(logger: Logger, repoChangeCallback: () => void) {
		this.logger = logger;
		this.repoChangeCallback = repoChangeCallback;
	}

	public start(repo: string) {
		if (this.fsWatcher !== null) {
			// If there is an existing File System Watcher, stop it
			this.stop();
		}

		this.repo = repo;
		// Create a File System Watcher for all events within the specified repository
		this.fsWatcher = vscode.workspace.createFileSystemWatcher(repo + '/**');
		this.fsWatcher.onDidCreate(uri => this.refresh(uri));
		this.fsWatcher.onDidChange(uri => this.refresh(uri));
		this.fsWatcher.onDidDelete(uri => this.refresh(uri));
		this.logger.log('Started watching repo: ' + repo);
	}

	public stop() {
		if (this.fsWatcher !== null) {
			// If there is an existing File System Watcher, stop it
			this.fsWatcher.dispose();
			this.fsWatcher = null;
			this.logger.log('Stopped watching repo: ' + this.repo);
		}
		if (this.refreshTimeout !== null) {
			// If a timeout is active, clear it
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	// Mute and unmute events - used to prevent many change events being triggered when git actions are run via the Git Graph view
	public mute() {
		this.muted = true;
	}
	public unmute() {
		this.muted = false;
		this.resumeAt = (new Date()).getTime() + 1500;
	}

	// Handle an event detected by the File System Watcher
	private async refresh(uri: vscode.Uri) {
		if (this.muted) return;
		if (!getPathFromUri(uri).replace(this.repo + '/', '').match(FILE_CHANGE_REGEX)) return;
		if ((new Date()).getTime() < this.resumeAt) return;

		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.repoChangeCallback();
		}, 750);
	}
}
