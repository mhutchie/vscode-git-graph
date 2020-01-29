import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { CommandManager } from './commands';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { findGit, getGitExecutable, GitExecutable, showErrorMessage, showInformationMessage, UNABLE_TO_FIND_GIT_MSG } from './utils';

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
		showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		logger.logError(UNABLE_TO_FIND_GIT_MSG);
	}

	const dataSource = new DataSource(gitExecutable, logger);
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const statusBarItem = new StatusBarItem();
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem, logger);
	const commandManager = new CommandManager(context.extensionPath, avatarManager, dataSource, extensionState, logger, repoManager, gitExecutable);

	context.subscriptions.push(
		commandManager,
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			} else if (e.affectsConfiguration('git-graph.dateType') || e.affectsConfiguration('git-graph.showSignatureStatus') || e.affectsConfiguration('git-graph.useMailmap')) {
				dataSource.generateGitCommandFormats();
			} else if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			} else if (e.affectsConfiguration('git.path')) {
				const path = getConfig().gitPath;
				if (path === null) return;

				getGitExecutable(path).then(exec => {
					gitExecutable = exec;
					extensionState.setLastKnownGitPath(gitExecutable.path);
					dataSource.setGitExecutable(gitExecutable);
					commandManager.setGitExecutable(gitExecutable);

					let msg = 'Git Graph is now using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')';
					showInformationMessage(msg);
					logger.log(msg);
					repoManager.searchWorkspaceForRepos();
				}, () => {
					let msg = 'The new value of "git.path" (' + path + ') does not match the path and filename of a valid Git executable.';
					showErrorMessage(msg);
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
