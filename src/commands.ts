import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { getPathFromUri, getRepoName, GitExecutable, isPathInWorkspace, resolveToSymbolicPath, showErrorMessage, showInformationMessage, UNABLE_TO_FIND_GIT_MSG } from './utils';


export class CommandManager implements vscode.Disposable {
	private readonly extensionPath: string;
	private readonly avatarManager: AvatarManager;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly repoManager: RepoManager;
	private gitExecutable: GitExecutable | null;
	private subscriptions: vscode.Disposable[] = [];

	constructor(extensionPath: string, avatarManger: AvatarManager, dataSource: DataSource, extensionState: ExtensionState, logger: Logger, repoManager: RepoManager, gitExecutable: GitExecutable | null) {
		this.extensionPath = extensionPath;
		this.avatarManager = avatarManger;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.logger = logger;
		this.repoManager = repoManager;
		this.gitExecutable = gitExecutable;

		this.registerCommand('git-graph.view', (arg) => this.view(arg));
		this.registerCommand('git-graph.addGitRepository', () => this.addGitRepository());
		this.registerCommand('git-graph.removeGitRepository', () => this.removeGitRepository());
		this.registerCommand('git-graph.clearAvatarCache', () => this.clearAvatarCache());
		this.registerCommand('git-graph.endAllWorkspaceCodeReviews', () => this.endAllWorkspaceCodeReviews());
	}

	public dispose() {
		this.subscriptions.forEach((subscription) => {
			subscription.dispose();
		});
		this.subscriptions = [];
	}

	public setGitExecutable(gitExecutable: GitExecutable | null) {
		this.gitExecutable = gitExecutable;
	}

	private registerCommand(command: string, callback: (...args: any[]) => any) {
		this.subscriptions.push(vscode.commands.registerCommand(command, callback));
	}


	/* Commands */

	private async view(arg: any) {
		let loadRepo: string | null = null;

		if (typeof arg === 'object' && arg.rootUri) {
			// If command is run from the Visual Studio Code Source Control View, load the specific repo
			const repoPath = getPathFromUri(arg.rootUri);
			loadRepo = await this.repoManager.getKnownRepo(repoPath);
			if (loadRepo === null) {
				// The repo is not currently known, add it
				loadRepo = (await this.repoManager.registerRepo(await resolveToSymbolicPath(repoPath), true)).root;
			}
		} else if (getConfig().openToTheRepoOfTheActiveTextEditorDocument && vscode.window.activeTextEditor) {
			// If the config setting is enabled, load the repo containing the active text editor document
			loadRepo = this.repoManager.getRepoContainingFile(getPathFromUri(vscode.window.activeTextEditor.document.uri));
		}

		GitGraphView.createOrShow(this.extensionPath, this.dataSource, this.extensionState, this.avatarManager, this.repoManager, this.logger, loadRepo);
	}

	private addGitRepository() {
		if (this.gitExecutable === null) {
			showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
			return;
		}

		vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(uris => {
			if (uris && uris.length > 0) {
				let path = getPathFromUri(uris[0]);
				if (isPathInWorkspace(path)) {
					this.repoManager.registerRepo(path, false).then(status => {
						if (status.error === null) {
							showInformationMessage('The repository "' + status.root! + '" was added to Git Graph.');
						} else {
							showErrorMessage(status.error + ' Therefore it could not be added to Git Graph.');
						}
					});
				} else {
					showErrorMessage('The folder "' + path + '" is not within the opened Visual Studio Code workspace, and therefore could not be added to Git Graph.');
				}
			}
		}, () => { });
	}

	private removeGitRepository() {
		if (this.gitExecutable === null) {
			showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
			return;
		}

		let repoPaths = Object.keys(this.repoManager.getRepos());
		let items: vscode.QuickPickItem[] = repoPaths.map(path => ({ label: getRepoName(path), description: path }));

		vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select a repository to remove from Git Graph' }).then((item) => {
			if (item && item.description !== undefined) {
				if (this.repoManager.ignoreRepo(item.description)) {
					showInformationMessage('The repository "' + item.label + '" was removed from Git Graph.');
				} else {
					showErrorMessage('The repository "' + item.label + '" is not known to Git Graph.');
				}
			}
		}, () => { });
	}

	private clearAvatarCache() {
		this.avatarManager.clearCache();
	}

	private endAllWorkspaceCodeReviews() {
		this.extensionState.endAllWorkspaceCodeReviews();
		showInformationMessage('Ended All Code Reviews in Workspace');
	}
}
