import './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('fs');

import * as fs from 'fs';
import { ExtensionState } from '../src/extensionState';
import { BooleanOverride, FileViewType, GitGraphViewGlobalState, GitGraphViewWorkspaceState, GitRepoState, RepoCommitOrdering } from '../src/types';
import { GitExecutable } from '../src/utils';
import { EventEmitter } from '../src/utils/event';

let extensionContext = vscode.mocks.extensionContext;
let workspaceConfiguration = vscode.mocks.workspaceConfiguration;
let onDidChangeGitExecutable: EventEmitter<GitExecutable>;

beforeAll(() => {
	onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
});

afterAll(() => {
	onDidChangeGitExecutable.dispose();
});

describe('ExtensionState', () => {
	let extensionState: ExtensionState;
	beforeEach(() => {
		extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);
	});
	afterEach(() => {
		extensionState.dispose();
	});

	describe('GitExecutable Change Event Processing', () => {
		it('Should subscribe to GitExecutable change events', () => {
			// Assert
			expect(onDidChangeGitExecutable['listeners']).toHaveLength(1);
		});

		it('Should unsubscribe from GitExecutable change events after disposal', () => {
			// Run
			extensionState.dispose();

			// Assert
			expect(onDidChangeGitExecutable['listeners']).toHaveLength(0);
		});

		it('Should save the last known git executable path received from GitExecutable change events', () => {
			// Run
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '1.2.3' });

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('lastKnownGitPath', '/path/to/git');
		});
	});

	describe('getRepos', () => {
		it('Should return the stored repositories', () => {
			// Setup
			const repoState: GitRepoState = {
				cdvDivider: 0.5,
				cdvHeight: 250,
				columnWidths: null,
				commitOrdering: RepoCommitOrdering.AuthorDate,
				fileViewType: FileViewType.List,
				hideRemotes: [],
				includeCommitsMentionedByReflogs: BooleanOverride.Enabled,
				issueLinkingConfig: null,
				lastImportAt: 0,
				name: 'Custom Name',
				onlyFollowFirstParent: BooleanOverride.Disabled,
				onRepoLoadShowCheckedOutBranch: BooleanOverride.Enabled,
				onRepoLoadShowSpecificBranches: ['master'],
				pullRequestConfig: null,
				showRemoteBranches: true,
				showRemoteBranchesV2: BooleanOverride.Enabled,
				showStashes: BooleanOverride.Enabled,
				showTags: BooleanOverride.Enabled,
				workspaceFolderIndex: 0
			};
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': repoState
			});

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': repoState
			});
		});

		it('Should assign missing repository state variables to their default values', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					columnWidths: null,
					hideRemotes: []
				}
			});

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
		});

		it('Should migrate showRemoteBranches = TRUE from boolean to enum (repository.showRemoteBranches = TRUE)', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					showRemoteBranches: true
				}
			});
			vscode.mockExtensionSettingReturnValue('repository.showRemoteBranches', true);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
		});

		it('Should migrate showRemoteBranches = FALSE from boolean to enum (repository.showRemoteBranches = TRUE)', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					showRemoteBranches: false
				}
			});
			vscode.mockExtensionSettingReturnValue('repository.showRemoteBranches', true);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: false,
					showRemoteBranchesV2: BooleanOverride.Disabled,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
		});

		it('Should migrate showRemoteBranches = FALSE from boolean to enum (repository.showRemoteBranches = FALSE)', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					showRemoteBranches: false
				}
			});
			vscode.mockExtensionSettingReturnValue('repository.showRemoteBranches', false);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: false,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
		});

		it('Should migrate showRemoteBranches = TRUE from boolean to enum (repository.showRemoteBranches = FALSE)', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					showRemoteBranches: true
				}
			});
			vscode.mockExtensionSettingReturnValue('repository.showRemoteBranches', false);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Enabled,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
		});

		it('Should migrate multiple showRemoteBranches from boolean to enum (repository.showRemoteBranches = TRUE)', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo-1': {
					showRemoteBranches: true
				},
				'/path/to/repo-2': {
					showRemoteBranches: false
				}
			});
			vscode.mockExtensionSettingReturnValue('repository.showRemoteBranches', true);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/repo-1': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				},
				'/path/to/repo-2': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 0,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: false,
					showRemoteBranchesV2: BooleanOverride.Disabled,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: null
				}
			});
			expect(workspaceConfiguration.get).toHaveBeenCalledTimes(1);
		});

		it('Should return the default value if it is not defined', () => {
			// Setup
			extensionContext.workspaceState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getRepos();

			// Assert
			expect(result).toStrictEqual({});
		});
	});

	describe('saveRepos', () => {
		it('Should store the provided repositories in the workspace state', () => {
			// Setup
			const repos = {};
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.saveRepos(repos);

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('repoStates', repos);
		});
	});

	describe('transferRepo', () => {
		it('Should update the last active repo and code reviews with the new repository path', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce('/path/to/repo');
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.transferRepo('/path/to/repo', '/new/path/to/repo');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenNthCalledWith(1, 'lastActiveRepo', '/new/path/to/repo');
			expect(extensionContext.workspaceState.update).toHaveBeenNthCalledWith(2, 'codeReviews', {
				'/new/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
		});

		it('Shouldn\'t update the last active repo or code reviews when no match is found with the transfer repository', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce('/path/to/repo');
			extensionContext.workspaceState.get.mockReturnValueOnce({
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});

			// Run
			extensionState.transferRepo('/path/to/repo1', '/new/path/to/repo');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
		});
	});

	describe('getGlobalViewState', () => {
		it('Should return the stored global view state', () => {
			// Setup
			const globalViewState: GitGraphViewGlobalState = {
				alwaysAcceptCheckoutCommit: true,
				issueLinkingConfig: null,
				pushTagSkipRemoteCheck: false
			};
			extensionContext.globalState.get.mockReturnValueOnce(globalViewState);

			// Run
			const result = extensionState.getGlobalViewState();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('globalViewState', expect.anything());
			expect(result).toStrictEqual(globalViewState);
		});

		it('Should assign missing global view state variables to their default values', () => {
			// Setup
			extensionContext.globalState.get.mockReturnValueOnce({
				issueLinkingConfig: null
			});

			// Run
			const result = extensionState.getGlobalViewState();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('globalViewState', expect.anything());
			expect(result).toStrictEqual({
				alwaysAcceptCheckoutCommit: false,
				issueLinkingConfig: null,
				pushTagSkipRemoteCheck: false
			});
		});

		it('Should return the default global view state if it is not defined', () => {
			// Setup
			extensionContext.globalState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getGlobalViewState();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('globalViewState', expect.anything());
			expect(result).toStrictEqual({
				alwaysAcceptCheckoutCommit: false,
				issueLinkingConfig: null,
				pushTagSkipRemoteCheck: false
			});
		});
	});

	describe('setGlobalViewState', () => {
		it('Should successfully store the global view state', async () => {
			// Setup
			const globalViewState: GitGraphViewGlobalState = {
				alwaysAcceptCheckoutCommit: true,
				issueLinkingConfig: null,
				pushTagSkipRemoteCheck: false
			};
			extensionContext.globalState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.setGlobalViewState(globalViewState);

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('globalViewState', globalViewState);
			expect(result).toBe(null);
		});

		it('Should return an error message when vscode is unable to store the global view state', async () => {
			// Setup
			const globalViewState: GitGraphViewGlobalState = {
				alwaysAcceptCheckoutCommit: true,
				issueLinkingConfig: null,
				pushTagSkipRemoteCheck: false
			};
			extensionContext.globalState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.setGlobalViewState(globalViewState);

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('globalViewState', globalViewState);
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Global State Memento.');
		});
	});

	describe('getWorkspaceViewState', () => {
		it('Should return the stored workspace view state', () => {
			// Setup
			const workspaceViewState: GitGraphViewWorkspaceState = {
				findIsCaseSensitive: true,
				findIsRegex: false,
				findOpenCommitDetailsView: true
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(workspaceViewState);

			// Run
			const result = extensionState.getWorkspaceViewState();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('workspaceViewState', expect.anything());
			expect(result).toStrictEqual(workspaceViewState);
		});

		it('Should assign missing workspace view state variables to their default values', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce({
				findIsCaseSensitive: true,
				findIsRegex: false
			});

			// Run
			const result = extensionState.getWorkspaceViewState();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('workspaceViewState', expect.anything());
			expect(result).toStrictEqual({
				findIsCaseSensitive: true,
				findIsRegex: false,
				findOpenCommitDetailsView: false
			});
		});

		it('Should return the default workspace view state if it is not defined', () => {
			// Setup
			extensionContext.workspaceState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getWorkspaceViewState();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('workspaceViewState', expect.anything());
			expect(result).toStrictEqual({
				findIsCaseSensitive: false,
				findIsRegex: false,
				findOpenCommitDetailsView: false
			});
		});
	});

	describe('setWorkspaceViewState', () => {
		it('Should successfully store the workspace view state', async () => {
			// Setup
			const workspaceViewState: GitGraphViewWorkspaceState = {
				findIsCaseSensitive: true,
				findIsRegex: false,
				findOpenCommitDetailsView: true
			};
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.setWorkspaceViewState(workspaceViewState);

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('workspaceViewState', workspaceViewState);
			expect(result).toBe(null);
		});

		it('Should return an error message when vscode is unable to store the workspace view state', async () => {
			// Setup
			const workspaceViewState: GitGraphViewWorkspaceState = {
				findIsCaseSensitive: true,
				findIsRegex: false,
				findOpenCommitDetailsView: true
			};
			extensionContext.workspaceState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.setWorkspaceViewState(workspaceViewState);

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('workspaceViewState', workspaceViewState);
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Workspace State Memento.');
		});
	});

	describe('getIgnoredRepos', () => {
		it('Should return the stored ignored repositories', () => {
			// Setup
			const ignoredRepos = ['/ignored-repo1'];
			extensionContext.workspaceState.get.mockReturnValueOnce(ignoredRepos);

			// Run
			const result = extensionState.getIgnoredRepos();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('ignoredRepos', []);
			expect(result).toBe(ignoredRepos);
		});

		it('Should return the default value if not defined', () => {
			// Setup
			extensionContext.workspaceState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getIgnoredRepos();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('ignoredRepos', []);
			expect(result).toStrictEqual([]);
		});
	});

	describe('setIgnoredRepos', () => {
		it('Should successfully store the ignored repositories', async () => {
			// Setup
			const ignoreRepos = ['/path/to/ignore'];
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.setIgnoredRepos(ignoreRepos);

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('ignoredRepos', ignoreRepos);
			expect(result).toBe(null);
		});

		it('Should return an error message when vscode is unable to store the ignored repositories', async () => {
			// Setup
			const ignoreRepos = ['/path/to/ignore'];
			extensionContext.workspaceState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.setIgnoredRepos(ignoreRepos);

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('ignoredRepos', ignoreRepos);
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Workspace State Memento.');
		});
	});

	describe('getLastActiveRepo', () => {
		it('Should return the stored last active repository', () => {
			// Setup
			extensionContext.workspaceState.get.mockReturnValueOnce('/last/active/repo');

			// Run
			const result = extensionState.getLastActiveRepo();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('lastActiveRepo', null);
			expect(result).toBe('/last/active/repo');
		});

		it('Should return the default value if not defined', () => {
			// Setup
			extensionContext.workspaceState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getLastActiveRepo();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('lastActiveRepo', null);
			expect(result).toBe(null);
		});
	});

	describe('setLastActiveRepo', () => {
		it('Should store the last active repository', () => {
			// Setup
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.setLastActiveRepo('/path/to/repo');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('lastActiveRepo', '/path/to/repo');
		});
	});

	describe('getLastKnownGitPath', () => {
		it('Should return the stored last active repository', () => {
			// Setup
			extensionContext.globalState.get.mockReturnValueOnce('/path/to/git');

			// Run
			const result = extensionState.getLastKnownGitPath();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('lastKnownGitPath', null);
			expect(result).toBe('/path/to/git');
		});

		it('Should return the default value if not defined', () => {
			// Setup
			extensionContext.globalState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getLastKnownGitPath();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('lastKnownGitPath', null);
			expect(result).toBe(null);
		});
	});

	describe('isAvatarStorageAvailable', () => {
		it('Should return TRUE if the avatar storage folder existed on startup', () => {
			// Setup
			const spyOnStat = jest.spyOn(fs, 'stat');
			spyOnStat.mockImplementationOnce((_, callback) => callback(null, {} as fs.Stats));
			const extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);

			// Run
			const result = extensionState.isAvatarStorageAvailable();

			// Assert
			expect(spyOnStat.mock.calls[0][0]).toBe('/path/to/globalStorage/avatars');
			expect(result).toBe(true);

			// Teardown
			extensionState.dispose();
		});

		it('Should return TRUE if the avatar storage folder was successfully created', () => {
			// Setup
			jest.spyOn(fs, 'stat').mockImplementationOnce((_, callback) => callback(new Error(), {} as fs.Stats));
			const spyOnMkdir = jest.spyOn(fs, 'mkdir');
			spyOnMkdir.mockImplementation((_, callback) => callback(null));
			const extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);

			// Run
			const result = extensionState.isAvatarStorageAvailable();

			// Assert
			expect(spyOnMkdir.mock.calls[0][0]).toBe('/path/to/globalStorage');
			expect(spyOnMkdir.mock.calls[1][0]).toBe('/path/to/globalStorage/avatars');
			expect(result).toBe(true);

			// Teardown
			extensionState.dispose();
		});

		it('Should return TRUE if the avatar storage folder was created after the initial stat check', () => {
			// Setup
			jest.spyOn(fs, 'stat').mockImplementationOnce((_, callback) => callback(new Error(), {} as fs.Stats));
			const spyOnMkdir = jest.spyOn(fs, 'mkdir');
			spyOnMkdir.mockImplementation((_, callback) => callback({ code: 'EEXIST' } as NodeJS.ErrnoException));
			const extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);

			// Run
			const result = extensionState.isAvatarStorageAvailable();

			// Assert
			expect(spyOnMkdir.mock.calls[0][0]).toBe('/path/to/globalStorage');
			expect(spyOnMkdir.mock.calls[1][0]).toBe('/path/to/globalStorage/avatars');
			expect(result).toBe(true);

			// Teardown
			extensionState.dispose();
		});

		it('Should return FALSE if the avatar storage folder could not be created', () => {
			// Setup
			jest.spyOn(fs, 'stat').mockImplementationOnce((_, callback) => callback(new Error(), {} as fs.Stats));
			const spyOnMkdir = jest.spyOn(fs, 'mkdir');
			spyOnMkdir.mockImplementation((_, callback) => callback({} as NodeJS.ErrnoException));
			const extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);

			// Run
			const result = extensionState.isAvatarStorageAvailable();

			// Assert
			expect(spyOnMkdir.mock.calls[0][0]).toBe('/path/to/globalStorage');
			expect(spyOnMkdir.mock.calls[1][0]).toBe('/path/to/globalStorage/avatars');
			expect(result).toBe(false);

			// Teardown
			extensionState.dispose();
		});
	});

	describe('getAvatarStoragePath', () => {
		it('Should return the avatar storage path', () => {
			// Run
			const result = extensionState.getAvatarStoragePath();

			// Assert
			expect(result).toBe('/path/to/globalStorage/avatars');
		});
	});

	describe('getAvatarCache', () => {
		it('Should return the stored avatar cache', () => {
			// Setup
			const cache = {};
			extensionContext.globalState.get.mockReturnValueOnce(cache);

			// Run
			const result = extensionState.getAvatarCache();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('avatarCache', {});
			expect(result).toBe(cache);
		});

		it('Should return the default value if not defined', () => {
			// Setup
			extensionContext.globalState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getAvatarCache();

			// Assert
			expect(extensionContext.globalState.get).toHaveBeenCalledWith('avatarCache', {});
			expect(result).toStrictEqual({});
		});
	});

	describe('saveAvatar', () => {
		it('Should save the avatar to the avatar cache', () => {
			// Setup
			const avatar = { image: 'name.jpg', timestamp: 0, identicon: false };
			extensionContext.globalState.get.mockReturnValueOnce({});
			extensionContext.globalState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.saveAvatar('test@example.com', avatar);

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', { 'test@example.com': avatar });
		});
	});

	describe('removeAvatarFromCache', () => {
		it('Should remove an avatar from the cache', () => {
			// Setup
			const avatar = { image: 'name.jpg', timestamp: 0, identicon: false };
			extensionContext.globalState.get.mockReturnValueOnce({
				'test1@example.com': avatar,
				'test2@example.com': avatar
			});
			extensionContext.globalState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.removeAvatarFromCache('test1@example.com');

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', { 'test2@example.com': avatar });
		});
	});

	describe('clearAvatarCache', () => {
		let spyOnReaddir: jest.SpyInstance, spyOnUnlink: jest.SpyInstance;
		beforeAll(() => {
			spyOnReaddir = jest.spyOn(fs, 'readdir');
			spyOnUnlink = jest.spyOn(fs, 'unlink');
		});

		it('Should clear all avatars from the cache and delete all avatars that are currently stored on the file system', async () => {
			// Setup
			extensionContext.globalState.update.mockResolvedValueOnce(null);
			spyOnReaddir.mockImplementationOnce((_, callback) => callback(null, ['file1.jpg', 'file2.jpg']));
			spyOnUnlink.mockImplementationOnce((_, callback) => callback(null));
			spyOnUnlink.mockImplementationOnce((_, callback) => callback(null));

			// Run
			const result = await extensionState.clearAvatarCache();

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', {});
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir).toHaveBeenNthCalledWith(1, '/path/to/globalStorage/avatars', expect.anything());
			expect(spyOnUnlink).toHaveBeenCalledTimes(2);
			expect(spyOnUnlink).toHaveBeenNthCalledWith(1, '/path/to/globalStorage/avatars/file1.jpg', expect.anything());
			expect(spyOnUnlink).toHaveBeenNthCalledWith(2, '/path/to/globalStorage/avatars/file2.jpg', expect.anything());
		});

		it('Should skip deleting avatars on the file system if they could not be listed from the file system', async () => {
			// Setup
			extensionContext.globalState.update.mockResolvedValueOnce(null);
			spyOnReaddir.mockImplementationOnce((_, callback) => callback(new Error(), ['file1.jpg', 'file2.jpg']));

			// Run
			const result = await extensionState.clearAvatarCache();

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', {});
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir).toHaveBeenNthCalledWith(1, '/path/to/globalStorage/avatars', expect.anything());
			expect(spyOnUnlink).toHaveBeenCalledTimes(0);
		});

		it('Shouldn\'t delete avatars on the file system if globalState.update rejects, and return the error message', async () => {
			// Setup
			extensionContext.globalState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.clearAvatarCache();

			// Assert
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Global State Memento.');
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', {});
			expect(spyOnReaddir).not.toHaveBeenCalled();
		});
	});

	describe('startCodeReview', () => {
		it('Should store the code review (in a repository with no prior code reviews)', async () => {
			// Setup
			const codeReviews = {};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.startCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', ['file2.txt', 'file3.txt'], 'file1.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
			expect(result).toStrictEqual({
				codeReview: {
					id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
					lastActive: 1587559258000,
					lastViewedFile: 'file1.txt',
					remainingFiles: ['file2.txt', 'file3.txt']
				},
				error: null
			});
		});

		it('Should store the code review (in a repository with a prior code review)', async () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.startCodeReview('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', ['file5.txt', 'file6.txt'], 'file4.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					},
					'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b': {
						lastActive: 1587559258000,
						lastViewedFile: 'file4.txt',
						remainingFiles: ['file5.txt', 'file6.txt']
					}
				}
			});
			expect(result).toStrictEqual({
				codeReview: {
					id: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					lastActive: 1587559258000,
					lastViewedFile: 'file4.txt',
					remainingFiles: ['file5.txt', 'file6.txt']
				},
				error: null
			});
		});

		it('Should return an error message when vscode is unable to store the code reviews', async () => {
			// Setup
			const codeReviews = {};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.startCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', ['file2.txt', 'file3.txt'], 'file1.txt');

			// Assert
			expect(result.error).toBe('Visual Studio Code was unable to save the Git Graph Workspace State Memento.');
		});
	});

	describe('endCodeReview', () => {
		it('Should store the updated code reviews, without the code review that was ended (no more code reviews in repo)', async () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.endCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {});
			expect(result).toBe(null);
		});

		it('Should store the updated code reviews, without the code review that was ended (more code reviews in repo)', async () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					},
					'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b': {
						lastActive: 1587559258000,
						lastViewedFile: 'file4.txt',
						remainingFiles: ['file5.txt', 'file6.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.endCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b': {
						lastActive: 1587559258000,
						lastViewedFile: 'file4.txt',
						remainingFiles: ['file5.txt', 'file6.txt']
					}
				}
			});
			expect(result).toBe(null);
		});

		it('Should not make changes to the stored code reviews if the code review that was ended no longer exists', async () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.endCodeReview('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
			expect(result).toBe(null);
		});

		it('Should return an error message when vscode is unable to store the code reviews', async () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.endCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Workspace State Memento.');
		});
	});

	describe('getCodeReview', () => {
		it('Should return the code review, and update its last active timestamp', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559257000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			const result = extensionState.getCodeReview('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
			expect(result).toStrictEqual({
				id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				lastActive: 1587559258000,
				lastViewedFile: 'file1.txt',
				remainingFiles: ['file2.txt', 'file3.txt']
			});
		});

		it('Should return NULL if no code review could be found in the specified repository', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559257000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);

			// Run
			const result = extensionState.getCodeReview('/path/to/repo1', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(result).toBe(null);
		});

		it('Should return NULL if no code review could be found with the specified id', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559257000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);

			// Run
			const result = extensionState.getCodeReview('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
		});
	});

	describe('updateCodeReview', () => {
		const repo = '/path/to/repo';
		const id = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
		const startTime = 1587559257000;
		const endTime = startTime + 1000;

		beforeEach(() => {
			const codeReviews = {
				[repo]: {
					[id]: {
						lastActive: startTime,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};

			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);
		});

		it('Should update the reviewed files and change the last viewed file', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id, ['file3.txt'], 'file2.txt');

			// Asset
			expect(result).toBeNull();
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				[repo]: {
					[id]: {
						lastActive: endTime,
						lastViewedFile: 'file2.txt',
						remainingFiles: ['file3.txt']
					}
				}
			});
		});

		it('Should update the reviewed files without changing the last viewed file', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id, ['file3.txt'], null);

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				[repo]: {
					[id]: {
						lastActive: endTime,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file3.txt']
					}
				}
			});
		});

		it('Should update the not reviewed files without changing the last viewed file', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id, ['file2.txt', 'file3.txt', 'file4.txt'], null);

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				[repo]: {
					[id]: {
						lastActive: endTime,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt', 'file4.txt']
					}
				}
			});
		});

		it('Should set the last viewed file', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id, ['file2.txt', 'file3.txt'], 'file2.txt');

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				[repo]: {
					[id]: {
						lastActive: endTime,
						lastViewedFile: 'file2.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
		});

		it('Should remove the code review the last file in it has been reviewed', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id, [], null);

			// Assert
			expect(result).toBeNull();
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {});
		});

		it('Shouldn\'t change the state if no code review could be found in the specified repository', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo + '1', id, ['file3.txt'], null);

			// Assert
			expect(result).toBe('The Code Review could not be found.');
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
		});

		it('Shouldn\'t change the state if no code review could be found with the specified id', async () => {
			// Run
			const result = await extensionState.updateCodeReview(repo, id + '1', ['file3.txt'], null);

			// Assert
			expect(result).toBe('The Code Review could not be found.');
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
		});

		it('Should return an error message when workspaceState.update rejects', async () => {
			// Setup
			extensionContext.workspaceState.update.mockReset();
			extensionContext.workspaceState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.updateCodeReview(repo, id, ['file3.txt'], 'file2.txt');

			// Asset
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Workspace State Memento.');
		});
	});

	describe('expireOldCodeReviews', () => {
		it('Should delete all code reviews that have expired', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo1': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					},
					'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b': {
						lastActive: 0,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				},
				'/path/to/repo2': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 0,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.expireOldCodeReviews();

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo1': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			});
		});

		it('Shouldn\'t make any changes when no repositories have expired', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo1': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					},
					'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				},
				'/path/to/repo2': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file2.txt', 'file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);

			// Run
			extensionState.expireOldCodeReviews();

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
		});
	});

	describe('endAllWorkspaceCodeReviews', () => {
		it('Should store the last active repository', () => {
			// Setup
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.endAllWorkspaceCodeReviews();

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {});
		});
	});

	describe('getCodeReviews', () => {
		it('Should return the stored code reviews', () => {
			// Setup
			const codeReviews = {};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);

			// Run
			const result = extensionState.getCodeReviews();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('codeReviews', {});
			expect(result).toBe(codeReviews);
		});

		it('Should return the default value if not defined', () => {
			// Setup
			extensionContext.workspaceState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getCodeReviews();

			// Assert
			expect(extensionContext.workspaceState.get).toHaveBeenCalledWith('codeReviews', {});
			expect(result).toStrictEqual({});
		});
	});
});
