import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { CommandManager } from './commands';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { EventEmitter } from './event';
import { ExtensionState } from './extensionState';
import { onStartUp } from './life-cycle/startup';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { findGit, getGitExecutable, GitExecutable, showErrorMessage, showInformationMessage, UNABLE_TO_FIND_GIT_MSG } from './utils';

/**
 * Activate Git Graph.
 * @param context The context of the extension.
 */
export async function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	logger.log('Starting Git Graph ...');

	const gitExecutableEmitter = new EventEmitter<GitExecutable>();
	const onDidChangeGitExecutable = gitExecutableEmitter.subscribe;

	const extensionState = new ExtensionState(context, onDidChangeGitExecutable);

	let gitExecutable: GitExecutable | null;
	try {
		gitExecutable = await findGit(extensionState);
		gitExecutableEmitter.emit(gitExecutable);
		logger.log('Using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')');
	} catch (_) {
		gitExecutable = null;
		showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		logger.logError(UNABLE_TO_FIND_GIT_MSG);
	}

	const configurationEmitter = new EventEmitter<vscode.ConfigurationChangeEvent>();
	const onDidChangeConfiguration = configurationEmitter.subscribe;

	const dataSource = new DataSource(gitExecutable, onDidChangeConfiguration, onDidChangeGitExecutable, logger);
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const repoManager = new RepoManager(dataSource, extensionState, onDidChangeConfiguration, logger);
	const statusBarItem = new StatusBarItem(repoManager.getNumRepos(), repoManager.onDidChangeRepos, onDidChangeConfiguration, logger);
	const commandManager = new CommandManager(context.extensionPath, avatarManager, dataSource, extensionState, repoManager, gitExecutable, onDidChangeGitExecutable, logger);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('git-graph')) {
				configurationEmitter.emit(event);
			} else if (event.affectsConfiguration('git.path')) {
				const path = getConfig().gitPath;
				if (path === null) return;

				getGitExecutable(path).then((gitExecutable) => {
					gitExecutableEmitter.emit(gitExecutable);
					const msg = 'Git Graph is now using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')';
					showInformationMessage(msg);
					logger.log(msg);
					repoManager.searchWorkspaceForRepos();
				}, () => {
					const msg = 'The new value of "git.path" (' + path + ') does not match the path and filename of a valid Git executable.';
					showErrorMessage(msg);
					logger.logError(msg);
				});
			}
		}),
		commandManager,
		statusBarItem,
		repoManager,
		avatarManager,
		dataSource,
		configurationEmitter,
		extensionState,
		gitExecutableEmitter,
		logger
	);
	logger.log('Started Git Graph - Ready to use!');

	extensionState.expireOldCodeReviews();
	onStartUp(context).catch(() => { });
}

/**
 * Deactivate Git Graph.
 */
export function deactivate() { }
