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
import { findGit, getPathFromUri, GitExecutable, UNABLE_TO_FIND_GIT_MSG } from './utils';


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
		vscode.commands.registerCommand('git-graph.view', args => {
			let loadRepo: string | null = null;

			if (typeof args === 'object' && args.rootUri) {
				// If command is run from the SCP menu, load the specific repo
				loadRepo = getPathFromUri(args.rootUri);
				if (!repoManager.isKnownRepo(loadRepo)) {
					repoManager.registerRepo(loadRepo, true, true).then(valid => {
						if (!valid) loadRepo = null;
						GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, logger, loadRepo);
					});
					return;
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
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			} else if (e.affectsConfiguration('git-graph.dateType') || e.affectsConfiguration('git-graph.useMailmap')) {
				dataSource.generateGitCommandFormats();
			} else if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			} else if (e.affectsConfiguration('git.path')) {
				findGit(extensionState).then(exec => {
					gitExecutable = exec;
					extensionState.setLastKnownGitPath(gitExecutable.path);
					dataSource.setGitExecutable(gitExecutable);
					logger.log('Using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')');
					repoManager.searchWorkspaceForRepos();
				}, () => {
					if (gitExecutable === null) {
						vscode.window.showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
						logger.logError(UNABLE_TO_FIND_GIT_MSG);
					}
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
}

export function deactivate() { }
