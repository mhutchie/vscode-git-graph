import './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('fs');

import * as fs from 'fs';
import { EventEmitter } from '../src/event';
import { ExtensionState } from '../src/extensionState';
import { FileViewType, GitGraphViewGlobalState, IncludeCommitsMentionedByReflogs, OnlyFollowFirstParent, RepoCommitOrdering, ShowTags } from '../src/types';
import { GitExecutable } from '../src/utils';

let extensionContext = vscode.mocks.extensionContext;
let onDidChangeGitExecutable: EventEmitter<GitExecutable>;

beforeAll(() => {
	onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
});

afterAll(() => {
	onDidChangeGitExecutable.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
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
			const repoState = {
				columnWidths: null,
				cdvDivider: 0.5,
				cdvHeight: 250,
				commitOrdering: RepoCommitOrdering.AuthorDate,
				fileViewType: FileViewType.List,
				includeCommitsMentionedByReflogs: IncludeCommitsMentionedByReflogs.Enabled,
				onlyFollowFirstParent: OnlyFollowFirstParent.Disabled,
				issueLinkingConfig: null,
				pullRequestConfig: null,
				showRemoteBranches: true,
				showTags: ShowTags.Show,
				hideRemotes: []
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
					columnWidths: null,
					cdvDivider: 0.5,
					cdvHeight: 250,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					includeCommitsMentionedByReflogs: IncludeCommitsMentionedByReflogs.Default,
					onlyFollowFirstParent: OnlyFollowFirstParent.Default,
					issueLinkingConfig: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showTags: ShowTags.Default,
					hideRemotes: []
				}
			});
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
			const globalViewState = {
				alwaysAcceptCheckoutCommit: true,
				issueLinkingConfig: null
			};
			extensionContext.globalState.get.mockReturnValueOnce(globalViewState);

			// Run
			const result = extensionState.getGlobalViewState();

			// Assert
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
			expect(result).toStrictEqual({
				alwaysAcceptCheckoutCommit: false,
				issueLinkingConfig: null
			});
		});

		it('Should return the default global view state if it is not defined', () => {
			// Setup
			extensionContext.globalState.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const result = extensionState.getGlobalViewState();

			// Assert
			expect(result).toStrictEqual({
				alwaysAcceptCheckoutCommit: false,
				issueLinkingConfig: null
			});
		});
	});

	describe('setGlobalViewState', () => {
		it('Should successfully store the global view state', async () => {
			// Setup
			const globalViewState = {} as GitGraphViewGlobalState;
			extensionContext.globalState.update.mockResolvedValueOnce(null);

			// Run
			const result = await extensionState.setGlobalViewState(globalViewState);

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('globalViewState', globalViewState);
			expect(result).toBe(null);
		});

		it('Should return an error message when vscode is unable to store the global view state', async () => {
			// Setup
			const globalViewState = {} as GitGraphViewGlobalState;
			extensionContext.globalState.update.mockRejectedValueOnce(null);

			// Run
			const result = await extensionState.setGlobalViewState(globalViewState);

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('globalViewState', globalViewState);
			expect(result).toBe('Visual Studio Code was unable to save the Git Graph Global State Memento.');
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
		it('Should clear all avatars from the cache and delete all avatars that are currently stored on the file system', () => {
			extensionContext.globalState.update.mockResolvedValueOnce(null);
			const spyOnReaddir = jest.spyOn(fs, 'readdir');
			spyOnReaddir.mockImplementationOnce((_, callback) => callback(null, ['file1.jpg', 'file2.jpg']));
			const spyOnUnlink = jest.spyOn(fs, 'unlink');
			spyOnUnlink.mockImplementation((_, callback) => callback(null));

			// Run
			extensionState.clearAvatarCache();

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', {});
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir.mock.calls[0][0]).toBe('/path/to/globalStorage/avatars');
			expect(spyOnUnlink).toHaveBeenCalledTimes(2);
			expect(spyOnUnlink.mock.calls[0][0]).toBe('/path/to/globalStorage/avatars/file1.jpg');
			expect(spyOnUnlink.mock.calls[1][0]).toBe('/path/to/globalStorage/avatars/file2.jpg');
		});

		it('Should skip deleting avatars on the file system if they could not be listed from the file system', () => {
			extensionContext.globalState.update.mockResolvedValueOnce(null);
			const spyOnReaddir = jest.spyOn(fs, 'readdir');
			spyOnReaddir.mockImplementationOnce((_, callback) => callback(new Error(), ['file1.jpg', 'file2.jpg']));
			const spyOnUnlink = jest.spyOn(fs, 'unlink');
			spyOnUnlink.mockImplementation((_, callback) => callback(null));

			// Run
			extensionState.clearAvatarCache();

			// Assert
			expect(extensionContext.globalState.update).toHaveBeenCalledWith('avatarCache', {});
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir.mock.calls[0][0]).toBe('/path/to/globalStorage/avatars');
			expect(spyOnUnlink).toHaveBeenCalledTimes(0);
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

	describe('updateCodeReviewFileReviewed', () => {
		it('Should remove the reviewed file, set it as the last viewed file, and update the last active time', () => {
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
			extensionState.updateCodeReviewFileReviewed('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'file2.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file2.txt',
						remainingFiles: ['file3.txt']
					}
				}
			});
		});

		it('Should ignore removing reviewed files if it has already be stored as reviewed', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559257000,
						lastViewedFile: 'file1.txt',
						remainingFiles: ['file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.updateCodeReviewFileReviewed('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'file2.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559258000,
						lastViewedFile: 'file2.txt',
						remainingFiles: ['file3.txt']
					}
				}
			});
		});

		it('Should remove the code review the last file in it has been reviewed', () => {
			// Setup
			const codeReviews = {
				'/path/to/repo': {
					'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2': {
						lastActive: 1587559257000,
						lastViewedFile: 'file2.txt',
						remainingFiles: ['file3.txt']
					}
				}
			};
			extensionContext.workspaceState.get.mockReturnValueOnce(codeReviews);
			extensionContext.workspaceState.update.mockResolvedValueOnce(null);

			// Run
			extensionState.updateCodeReviewFileReviewed('/path/to/repo', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'file3.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledWith('codeReviews', {});
		});

		it('Shouldn\'t change the state if no code review could be found in the specified repository', () => {
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

			// Run
			extensionState.updateCodeReviewFileReviewed('/path/to/repo1', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'file2.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
		});

		it('Shouldn\'t change the state if no code review could be found with the specified id', () => {
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

			// Run
			extensionState.updateCodeReviewFileReviewed('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'file2.txt');

			// Assert
			expect(extensionContext.workspaceState.update).toHaveBeenCalledTimes(0);
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
