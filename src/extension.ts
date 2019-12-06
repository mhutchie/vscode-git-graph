import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { addGitRepository, removeGitRepositoy } from './commands';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { findGit, getGitExecutable, getPathFromUri, GitExecutable, resolveToSymbolicPath, UNABLE_TO_FIND_GIT_MSG } from './utils';


export async function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	logger.log('Starting Git Graph ...');

	const extensionState = new ExtensionState(context);

	let gitExecutable: GitExecutable | null;
	try {
		gitExecutable = await findGit(extensionState);
		extensionState.setLastKnownGitPath(gitExecutable.path);
		logger.log('Using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')');
	} catch (_) {
		gitExecutable = null;
		vscode.window.showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		logger.logError(UNABLE_TO_FIND_GIT_MSG);
	}

	const dataSource = new DataSource(gitExecutable, logger);
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const statusBarItem = new StatusBarItem();
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem, logger);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', async (args) => {
			let loadRepo: string | null = null;

			if (typeof args === 'object' && args.rootUri) {
				// If command is run from the Visual Studio Code Source Control View, load the specific repo
				const repoPath = getPathFromUri(args.rootUri);
				loadRepo = await repoManager.getKnownRepo(repoPath);
				if (loadRepo === null) {
					// The repo is not currently known, add it
					loadRepo = (await repoManager.registerRepo(await resolveToSymbolicPath(repoPath), true)).root;
				}
			} else if (getConfig().openToTheRepoOfTheActiveTextEditorDocument() && vscode.window.activeTextEditor) {
				// If the config setting is enabled, load the repo containing the active text editor document
				loadRepo = repoManager.getRepoContainingFile(getPathFromUri(vscode.window.activeTextEditor.document.uri));
			}

			GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, logger, loadRepo);
		}),
		vscode.commands.registerCommand('git-graph.addGitRepository', () => {
			addGitRepository(gitExecutable, repoManager);
		}),
		vscode.commands.registerCommand('git-graph.removeGitRepository', () => {
			removeGitRepositoy(gitExecutable, repoManager);
		}),
		vscode.commands.registerCommand('git-graph.clearAvatarCache', () => {
			avatarManager.clearCache();
		}),
		vscode.commands.registerCommand('git-graph.endAllWorkspaceCodeReviews', () => {
			extensionState.endAllWorkspaceCodeReviews();
			vscode.window.showInformationMessage('Ended All Code Reviews in Workspace');
		}),
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			} else if (e.affectsConfiguration('git-graph.dateType') || e.affectsConfiguration('git-graph.useMailmap')) {
				dataSource.generateGitCommandFormats();
			} else if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			} else if (e.affectsConfiguration('git.path')) {
				let path = getConfig().gitPath();
				if (path === null) return;

				getGitExecutable(path).then(exec => {
					gitExecutable = exec;
					extensionState.setLastKnownGitPath(gitExecutable.path);
					dataSource.setGitExecutable(gitExecutable);

					let msg = 'Git Graph is now using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')';
					vscode.window.showInformationMessage(msg);
					logger.log(msg);
					repoManager.searchWorkspaceForRepos();
				}, () => {
					let msg = 'The new value of "git.path" (' + path + ') does not match the path and filename of a valid Git executable.';
					vscode.window.showErrorMessage(msg);
					logger.logError(msg);
				});
			}
		}),
		repoManager,
		statusBarItem,
		avatarManager,
		dataSource,
		logger
	);
	logger.log('Started Git Graph - Ready to use!');

	extensionState.expireOldCodeReviews();
}

export function deactivate() { }
