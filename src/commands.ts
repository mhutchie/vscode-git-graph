import * as vscode from 'vscode';
import { RepoManager } from './repoManager';
import { getPathFromUri, getRepoName, GitExecutable, isPathInWorkspace, showErrorMessage, showInformationMessage, UNABLE_TO_FIND_GIT_MSG } from './utils';


export function addGitRepository(gitExecutable: GitExecutable | null, repoManager: RepoManager) {
	if (gitExecutable === null) {
		showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		return;
	}

	vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(uris => {
		if (uris && uris.length > 0) {
			let path = getPathFromUri(uris[0]);
			if (isPathInWorkspace(path)) {
				repoManager.registerRepo(path, false).then(status => {
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

export function removeGitRepositoy(gitExecutable: GitExecutable | null, repoManager: RepoManager) {
	if (gitExecutable === null) {
		showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		return;
	}

	let repoPaths = Object.keys(repoManager.getRepos());
	let items: vscode.QuickPickItem[] = repoPaths.map(path => ({ label: getRepoName(path), description: path }));

	vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select a repository to remove from Git Graph' }).then((item) => {
		if (item && item.description !== undefined) {
			if (repoManager.ignoreRepo(item.description)) {
				showInformationMessage('The repository "' + item.label + '" was removed from Git Graph.');
			} else {
				showErrorMessage('The repository "' + item.label + '" is not known to Git Graph.');
			}
		}
	}, () => { });
}