import './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('fs');
jest.mock('../src/dataSource');
jest.mock('../src/extensionState');
jest.mock('../src/logger');
jest.mock('../src/utils/bufferedQueue');

import * as fs from 'fs';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { ExtensionState } from '../src/extensionState';
import { Logger } from '../src/logger';
import { ExternalRepoConfig, RepoChangeEvent, RepoManager } from '../src/repoManager';
import * as utils from '../src/utils';
import * as bufferedQueue from '../src/utils/bufferedQueue';
import { EventEmitter } from '../src/utils/event';
import { BooleanOverride, FileViewType, GitRepoSet, GitRepoState, PullRequestProvider, RepoCommitOrdering } from '../src/types';

import { waitForExpect } from './helpers/expectations';
import { mockRepoState } from './helpers/utils';

let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<utils.GitExecutable>;
let logger: Logger;
let dataSource: DataSource;
let extensionState: ExtensionState;
let spyOnGetRepos: jest.SpyInstance, spyOnGetIgnoredRepos: jest.SpyInstance, spyOnSetIgnoredRepos: jest.SpyInstance, spyOnSaveRepos: jest.SpyInstance, spyOnTransferRepo: jest.SpyInstance, spyOnRepoRoot: jest.SpyInstance, spyOnGetSubmodules: jest.SpyInstance, spyOnLog: jest.SpyInstance, spyOnMkdir: jest.SpyInstance, spyOnReaddir: jest.SpyInstance, spyOnReadFile: jest.SpyInstance, spyOnStat: jest.SpyInstance, spyOnWriteFile: jest.SpyInstance;

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<utils.GitExecutable>();
	logger = new Logger();
	dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
	extensionState = new ExtensionState(vscode.mocks.extensionContext, onDidChangeGitExecutable.subscribe);
	spyOnGetRepos = jest.spyOn(extensionState, 'getRepos');
	spyOnGetIgnoredRepos = jest.spyOn(extensionState, 'getIgnoredRepos');
	spyOnSetIgnoredRepos = jest.spyOn(extensionState, 'setIgnoredRepos');
	spyOnSaveRepos = jest.spyOn(extensionState, 'saveRepos');
	spyOnTransferRepo = jest.spyOn(extensionState, 'transferRepo');
	spyOnRepoRoot = jest.spyOn(dataSource, 'repoRoot');
	spyOnGetSubmodules = jest.spyOn(dataSource, 'getSubmodules');
	spyOnLog = jest.spyOn(logger, 'log');
	spyOnMkdir = jest.spyOn(fs, 'mkdir');
	spyOnReaddir = jest.spyOn(fs, 'readdir');
	spyOnReadFile = jest.spyOn(fs, 'readFile');
	spyOnStat = jest.spyOn(fs, 'stat');
	spyOnWriteFile = jest.spyOn(fs, 'writeFile');

	spyOnReadFile.mockImplementation((_: string, callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void) => {
		callback(new Error(), Buffer.alloc(0));
	});

	jest.spyOn(bufferedQueue, 'BufferedQueue').mockImplementation(<T>(onItem: (item: T) => Promise<boolean>, onChanges: () => void) => {
		const realBufferedQueue = jest.requireActual('../src/utils/bufferedQueue');
		return new realBufferedQueue.BufferedQueue(onItem, onChanges, 1);
	});
});

afterAll(() => {
	extensionState.dispose();
	dataSource.dispose();
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

describe('RepoManager', () => {
	it('Should construct a RepoManager, and be disposed', async () => {
		// Run
		const repoManager = await constructRepoManagerAndWaitUntilStarted([], []);

		// Assert
		expect(repoManager['disposables']).toHaveLength(8);
		expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('**/.vscode/vscode-git-graph.json');

		// Run
		repoManager.dispose();

		// Assert
		expect(repoManager['disposables']).toHaveLength(0);
	});

	describe('onDidChangeWorkspaceFolders', () => {
		it('Should add repositories contained within an added workspace folder', async () => {
			// Setup
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted([], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepositoryWithNoSubmodules();

			// Run
			vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }];
			await emitOnDidChangeWorkspaceFolders!({ added: [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1');
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Teardown
			repoManager.dispose();
		});

		it('Should add repositories contained within an added workspace folder (unable to find workspaceFolderIndex)', async () => {
			// Setup
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted([], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepositoryWithNoSubmodules();

			// Run
			await emitOnDidChangeWorkspaceFolders!({ added: [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: null })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: null })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1');
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Teardown
			repoManager.dispose();
		});

		it('Should not emit a repo event when no repositories were contained within an added workspace folder', async () => {
			// Setup
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted([], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockDirectoryThatsNotRepository();

			// Run
			await emitOnDidChangeWorkspaceFolders!({ added: [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should remove repositories contained within a removed workspace folder', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2'],
				['/path/to/workspace-folder1', '/path/to/workspace-folder2', '/path/to/workspace-folder2/submodule']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			await emitOnDidChangeWorkspaceFolders!({ added: [], removed: [{ uri: vscode.Uri.file('/path/to/workspace-folder2') }] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder2');

			// Teardown
			repoManager.dispose();
		});

		it('Should not emit a repo event when no repositories were contained within a removed workspace folder', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2'],
				['/path/to/workspace-folder1']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			await emitOnDidChangeWorkspaceFolders!({ added: [], removed: [{ uri: vscode.Uri.file('/path/to/workspace-folder2') }] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should update all repositories workspaceFolderIndex\'s when workspace folders have been reordered', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2', '/path/to/workspace-folder3'],
				['/path/to/workspace-folder1', '/path/to/workspace-folder2', '/path/to/workspace-folder3']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2': mockRepoState({ workspaceFolderIndex: 1 }),
				'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 2 })
			});

			// Run
			vscode.workspace.workspaceFolders = [
				{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 },
				{ uri: vscode.Uri.file('/path/to/workspace-folder3'), index: 1 },
				{ uri: vscode.Uri.file('/path/to/workspace-folder2'), index: 2 }
			];
			await emitOnDidChangeWorkspaceFolders!({ added: [], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2': mockRepoState({ workspaceFolderIndex: 2 }),
				'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 1 })
			});
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2': mockRepoState({ workspaceFolderIndex: 2 }),
				'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 1 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 }),
						'/path/to/workspace-folder2': mockRepoState({ workspaceFolderIndex: 2 }),
						'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 1 })
					},
					numRepos: 3,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should not emit repo events is no changes occurred', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			let emitOnDidChangeWorkspaceFolders: (event: { added: { uri: vscode.Uri }[], removed: { uri: vscode.Uri }[] }) => Promise<void>;
			vscode.workspace.onDidChangeWorkspaceFolders.mockImplementationOnce((listener) => {
				emitOnDidChangeWorkspaceFolders = listener as () => Promise<void>;
				return { dispose: jest.fn() };
			});
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2'],
				['/path/to/workspace-folder1', '/path/to/workspace-folder2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			await emitOnDidChangeWorkspaceFolders!({ added: [], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2': mockRepoState({ workspaceFolderIndex: 1 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('maxDepthOfRepoSearchChanged', () => {
		it('Should not trigger a workspace search if the value hasn\'t increased', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const spyOnSearchWorkspaceForRepos = jest.spyOn(repoManager, 'searchWorkspaceForRepos');

			// Run
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 0);
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.maxDepthOfRepoSearch'
			});

			// Assert
			expect(spyOnSearchWorkspaceForRepos).toHaveBeenCalledTimes(0);

			// Teardown
			repoManager.dispose();
		});

		it('Should not be triggered when other extension settings are changed', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const spyOnSearchWorkspaceForRepos = jest.spyOn(repoManager, 'searchWorkspaceForRepos');

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.date.type'
			});

			// Assert
			expect(spyOnSearchWorkspaceForRepos).toHaveBeenCalledTimes(0);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('startupTasks', () => {
		it('Should run startup tasks', async () => {
			// Setup
			mockRepositoryWithNoSubmodules(); // Exists: /path/to/workspace-folder1/repo1
			mockDirectoryThatsNotRepository(); // Removed: Re/path/to/workspace-folder1/repo2
			mockRepositoryWithNoSubmodules(); // Exists: /path/to/another
			mockDirectoryThatsNotRepository(); // Not Repo: /path/to/workspace-folder1
			mockRepositoryWithNoSubmodules(); // New: /path/to/workspace-folder3

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/another/workspace-folder', '/path/to/workspace-folder3'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2', '/path/to/workspace-folder4', '/path/to/another']
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/another': mockRepoState({ workspaceFolderIndex: 1 }),
				'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 2 })
			});
			expect(spyOnSaveRepos).toHaveBeenCalledTimes(4);
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/another': mockRepoState({ workspaceFolderIndex: 1 }),
				'/path/to/workspace-folder3': mockRepoState({ workspaceFolderIndex: 2 })
			});
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/another/workspace-folder/**');
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder3/**');

			// Run
			repoManager.dispose();
		});

		it('Should run startup tasks (calls saveRepos when updateReposWorkspaceFolderIndex makes changes)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				{
					'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: null })
				}
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Run
			repoManager.dispose();
		});

		it('Should run startup tasks (doesn\'t call saveRepos when updateReposWorkspaceFolderIndex doesn\'t make changes)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				{
					'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
				}
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(spyOnSaveRepos).not.toHaveBeenCalled();
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Run
			repoManager.dispose();
		});

		it('Should run startup tasks (doesn\'t call sendRepos when checkReposExist makes changes)', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			mockDirectoryThatsNotRepository();

			// Run
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			const repoManager = constructRepoManager(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1']
			);
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			await waitForRepoManagerToStart();

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {},
					numRepos: 0,
					loadRepo: null
				}
			]);
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Run
			repoManager.dispose();
		});

		it('Should run startup tasks (calls sendRepos when checkReposExist doesn\'t make changes)', async () => {
			// Setup
			mockDirectoryThatsNotRepository();

			// Run
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			const repoManager = constructRepoManager(
				['/path/to/workspace-folder1'],
				[]
			);
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			await waitForRepoManagerToStart();

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {},
					numRepos: 0,
					loadRepo: null
				}
			]);
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/workspace-folder1/**');

			// Run
			repoManager.dispose();
		});
	});

	describe('removeReposNotInWorkspace', () => {
		it('Should remove repositories that aren\'t in the workspace', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1', '/path/to/workspace-folder2']
			);

			// Assert
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder2');

			// Teardown
			repoManager.dispose();
		});

		it('Should remove all repositories when no workspace folders exist', async () => {
			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(undefined, ['/path/to/workspace-folder1', '/path/to/workspace-folder2']);

			// Assert
			expect(spyOnSaveRepos).toHaveBeenCalledWith({});
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1');
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder2');

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t remove repositories that are within a workspace folder', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			// Assert
			await waitForExpect(() => {
				expect(spyOnRepoRoot).toHaveBeenCalledTimes(2);
				expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
				expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1');
				expect(repoManager.getRepos()).toStrictEqual({
					'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
				});
			});

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t remove repositories that contain a workspace folder', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to']);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledTimes(1);
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('registerRepo', () => {
		it('Should register a new repository', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1', '/path/to/workspace-folder2'], []);

			mockRepositoryWithNoSubmodules();
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder2/repo', false);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder2/repo');
			expect(result).toStrictEqual({
				root: '/path/to/workspace-folder2/repo',
				error: null
			});
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder2/repo');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder2/repo': mockRepoState({ workspaceFolderIndex: 1 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnReadFile).toHaveBeenCalledTimes(1);
			expect(utils.getPathFromStr(spyOnReadFile.mock.calls[0][0])).toStrictEqual('/path/to/workspace-folder2/repo/.vscode/vscode-git-graph.json');

			// Teardown
			repoManager.dispose();
		});

		it('Should register a new repository (loading it upon registration)', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			mockRepositoryWithNoSubmodules();

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder1/repo', true);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			expect(result).toStrictEqual({
				root: '/path/to/workspace-folder1/repo',
				error: null
			});
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: '/path/to/workspace-folder1/repo'
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should register a new repository (removing it from the ignored repositories)', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], [], ['/path/to/workspace-folder1/repo']);

			mockRepositoryWithNoSubmodules();

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder1/repo', true);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			expect(result).toStrictEqual({
				root: '/path/to/workspace-folder1/repo',
				error: null
			});
			expect(spyOnSetIgnoredRepos).toHaveBeenCalledWith([]);
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: '/path/to/workspace-folder1/repo'
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should register a new repository (should only update the workspaceFolderIndex for the repository that was added)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1', '/path/to/workspace-folder2'], ['/path/to/workspace-folder1']);
			repoManager['repos']['/path/to/workspace-folder1'].workspaceFolderIndex = null;

			mockRepositoryWithNoSubmodules();
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			await repoManager.registerRepo('/path/to/workspace-folder2/repo', false);

			// Assert
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: null }),
						'/path/to/workspace-folder2/repo': mockRepoState({ workspaceFolderIndex: 1 })
					},
					numRepos: 2,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should return an error message when the path being registered is not a Git repository', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			mockDirectoryThatsNotRepository();

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder1', false);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1');
			expect(result).toStrictEqual({
				root: null,
				error: 'The folder "/path/to/workspace-folder1" is not a Git repository.'
			});

			// Teardown
			repoManager.dispose();
		});

		it('Should return an error message when the path being registered is contained within a known Git repository', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1']);

			spyOnRepoRoot.mockResolvedValueOnce('/path/to/workspace-folder1');

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder1/subdirectory', false);

			// Assert
			expect(spyOnRepoRoot).toHaveBeenCalledWith('/path/to/workspace-folder1/subdirectory');
			expect(result).toStrictEqual({
				root: null,
				error: 'The folder "/path/to/workspace-folder1/subdirectory" is contained within the known repository "/path/to/workspace-folder1".'
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('ignoreRepo', () => {
		it('Should ignore the repository and return TRUE, when the repository is known', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = repoManager.ignoreRepo('/path/to/workspace-folder1');

			// Assert
			expect(result).toBe(true);
			expect(spyOnSetIgnoredRepos).toHaveBeenCalledWith(['/path/to/workspace-folder1']);
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {},
					numRepos: 0,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should ignore the repository and return TRUE, when the repository is known (without creating duplicates in the list of ignored repositories)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1'], ['/path/to/workspace-folder1']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = repoManager.ignoreRepo('/path/to/workspace-folder1');

			// Assert
			expect(result).toBe(true);
			expect(spyOnSetIgnoredRepos).toHaveBeenCalledWith(['/path/to/workspace-folder1']);
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {},
					numRepos: 0,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should return FALSE, when the repository is unknown', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			// Run
			const result = repoManager.ignoreRepo('/path/to/workspace-folder1');

			// Assert
			expect(result).toBe(false);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('getRepos', () => {
		it('Should get the set of repositories', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo2', '/path/to/workspace-folder1/repo1']
			);

			// Run
			const result = repoManager.getRepos();

			// Assert
			expect(result).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo2': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('getNumRepos', () => {
		it('Should get the number of repositories', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo2', '/path/to/workspace-folder1/repo1']
			);

			// Run
			const result = repoManager.getNumRepos();

			// Assert
			expect(result).toStrictEqual(2);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('getRepoContainingFile', () => {
		it('Should return the path of the repository that contains the file', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			// Run
			const result = repoManager.getRepoContainingFile('/path/to/workspace-folder1/repo2/file.txt');

			// Assert
			expect(result).toBe('/path/to/workspace-folder1/repo2');

			// Teardown
			repoManager.dispose();
		});

		it('Should return the path of the closest repository that contains the file', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo1/subrepo']
			);

			// Run
			const result = repoManager.getRepoContainingFile('/path/to/workspace-folder1/repo1/subrepo/file.txt');

			// Assert
			expect(result).toBe('/path/to/workspace-folder1/repo1/subrepo');

			// Teardown
			repoManager.dispose();
		});
	});

	describe('getKnownRepo', () => {
		it('Should return the path of the repository matching the specified path', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			// Run
			const result = await repoManager.getKnownRepo('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe('/path/to/workspace-folder1/repo1');

			// Teardown
			repoManager.dispose();
		});

		it('Should return the path of the repository matching the specified path (resolving symbolic path components)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/sym-repo1', '/path/to/workspace-folder1/sym-repo2']
			);

			const spyOnRealPath = jest.spyOn(utils, 'realpath');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo2');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo1');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo2');

			// Run
			const result = await repoManager.getKnownRepo('/path/to/workspace-folder1/repo2');

			// Assert
			expect(result).toBe('/path/to/workspace-folder1/sym-repo2');

			// Teardown
			repoManager.dispose();
		});

		it('Should return NULL if no repository matches the specified path', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const spyOnRealPath = jest.spyOn(utils, 'realpath');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo3');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo1');
			spyOnRealPath.mockResolvedValueOnce('/path/to/workspace-folder1/repo2');

			// Run
			const result = await repoManager.getKnownRepo('/path/to/workspace-folder1/repo3');

			// Assert
			expect(result).toBe(null);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('isKnownRepo', () => {
		it('Should return TRUE when the repository is known', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			// Run
			const result = repoManager.isKnownRepo('/path/to/workspace-folder1/repo');

			// Assert
			expect(result).toBe(true);

			// Teardown
			repoManager.dispose();
		});

		it('Should return FALSE when the repository is not known', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			// Run
			const result = repoManager.isKnownRepo('/path/to/workspace-folder1/other-repo');

			// Assert
			expect(result).toBe(false);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('checkReposExist', () => {
		it('Should remove any repositories that no longer exist', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepository();
			mockDirectoryThatsNotRepository();

			// Run
			const result = await repoManager.checkReposExist();

			// Assert
			expect(result).toBe(true);
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo2');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should transfer any repository state if the path to the repository changes', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo2': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Setup
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepository();
			mockRepository((path) => path.replace('workspace-folder1', 'workspace-folder2'));

			// Run
			const result = await repoManager.checkReposExist();

			// Assert
			expect(result).toBe(true);
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2/repo2': mockRepoState({ workspaceFolderIndex: 1 })
			});
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder2/repo2': mockRepoState({ workspaceFolderIndex: 1 })
			});
			expect(spyOnTransferRepo).toHaveBeenCalledWith('/path/to/workspace-folder1/repo2', '/path/to/workspace-folder2/repo2');
			expect(spyOnLog).toHaveBeenCalledWith('Transferred repo state: /path/to/workspace-folder1/repo2 -> /path/to/workspace-folder2/repo2');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
						'/path/to/workspace-folder2/repo2': mockRepoState({ workspaceFolderIndex: 1 })
					},
					numRepos: 2,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should return FALSE when no changes are made (all repositories still exist)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepository();
			mockRepository();

			// Run
			const result = await repoManager.checkReposExist();

			// Assert
			expect(result).toBe(false);
			expect(spyOnLog).not.toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo2');
			expect(onDidChangeReposEvents).toHaveLength(0);

			// Teardown
			repoManager.dispose();
		});

		it('Should return gracefully when an exception occurs', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1', '/path/to/workspace-folder2'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2', '/path/to/workspace-folder1/repo3']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepository((path) => path.replace('workspace-folder1', 'workspace-folder2'));
			mockRepository((path) => path.replace('workspace-folder1', 'workspace-folder2'));
			mockRepository((path) => path.replace('workspace-folder1', 'workspace-folder2'));
			spyOnTransferRepo.mockImplementationOnce(() => { });
			spyOnTransferRepo.mockImplementationOnce(() => { throw new Error(); });

			// Run
			const result = await repoManager.checkReposExist();

			// Assert
			expect(result).toBe(true);
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder2/repo1': mockRepoState({ workspaceFolderIndex: 1 }),
				'/path/to/workspace-folder2/repo2': mockRepoState({ workspaceFolderIndex: 1 }),
				'/path/to/workspace-folder1/repo3': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder2/repo1': mockRepoState({ workspaceFolderIndex: 1 }),
						'/path/to/workspace-folder2/repo2': mockRepoState({ workspaceFolderIndex: 1 }),
						'/path/to/workspace-folder1/repo3': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 3,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('setRepoState', () => {
		it('Should set the state of the repository', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const newRepoState = {
				cdvDivider: 0.75,
				cdvHeight: 300,
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
				workspaceFolderIndex: 0
			};

			// Run
			repoManager.setRepoState('/path/to/workspace-folder1/repo2', newRepoState);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo2': newRepoState
			});
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo2': newRepoState
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('searchWorkspaceForRepos', () => {
		it('Should add repositories that are detected in the workspace', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepositoryWithNoSubmodules();

			// Run
			const result = await repoManager.searchWorkspaceForRepos();

			// Assert
			expect(result).toBe(true);
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should add repositories that are detected in subfolders of the workspace', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockDirectoryThatsNotRepository();
			mockFsReaddirOnce(null, ['repo', '.git', 'file.txt']);
			mockFsStatOnce(null, true);
			mockFsStatOnce(null, false);
			mockRepositoryWithNoSubmodules();

			// Run
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 1);
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.maxDepthOfRepoSearch'
			});
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir).toHaveBeenCalledWith('/path/to/workspace-folder1', expect.anything());
			expect(spyOnStat).toHaveBeenCalledTimes(2);
			expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
			expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/file.txt', expect.anything());

			// Teardown
			repoManager.dispose();
		});

		it('Should halt recursion when fs.readdir returns an error', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockDirectoryThatsNotRepository();
			mockFsReaddirOnce(new Error(), []);
			spyOnLog.mockClear();

			// Run
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 1);
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.maxDepthOfRepoSearch'
			});
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Completed searching workspace for new repos'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir).toHaveBeenCalledWith('/path/to/workspace-folder1', expect.anything());
			expect(spyOnStat).toHaveBeenCalledTimes(0);

			// Teardown
			repoManager.dispose();
		});

		it('Should halt recursion when fs.stat returns an error', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockDirectoryThatsNotRepository();
			mockFsReaddirOnce(null, ['repo', '.git', 'file.txt']);
			mockFsStatOnce(new Error(), true);
			mockFsStatOnce(null, false);
			spyOnLog.mockClear();

			// Run
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 1);
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.maxDepthOfRepoSearch'
			});
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Completed searching workspace for new repos'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(spyOnReaddir).toHaveBeenCalledTimes(1);
			expect(spyOnReaddir).toHaveBeenCalledWith('/path/to/workspace-folder1', expect.anything());
			expect(spyOnStat).toHaveBeenCalledTimes(2);
			expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
			expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/file.txt', expect.anything());

			// Teardown
			repoManager.dispose();
		});

		it('Should halt recursion when repoRoot call rejects', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			spyOnRepoRoot.mockRejectedValueOnce(null);
			spyOnLog.mockClear();

			// Run
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 1);
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.maxDepthOfRepoSearch'
			});
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Completed searching workspace for new repos'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(spyOnReaddir).toHaveBeenCalledTimes(0);
			expect(spyOnStat).toHaveBeenCalledTimes(0);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('checkReposForNewSubmodules', () => {
		it('Should add any new submodules', async () => {
			// Setup
			mockRepositoryWithSubmodules(['/path/to/workspace-folder1/repo/submodule1', '/path/to/workspace-folder1/repo/submodule2']);
			mockRepositoryWithNoSubmodules();
			spyOnGetSubmodules.mockResolvedValueOnce([]);
			mockDirectoryThatsNotRepository();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo', '/path/to/workspace-folder1/repo/submodule1']
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo/submodule1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo/submodule2': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t add any submodules that are already known', async () => {
			// Setup
			mockRepositoryWithSubmodules(['/path/to/workspace-folder1/repo/submodule1', '/path/to/workspace-folder1/repo/submodule2']);
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo', '/path/to/workspace-folder1/repo/submodule1', '/path/to/workspace-folder1/repo/submodule2']
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo/submodule1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo/submodule2': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t add any submodules that have been ignored', async () => {
			// Setup
			mockRepositoryWithSubmodules(['/path/to/workspace-folder1/repo/submodule1', '/path/to/workspace-folder1/repo/submodule2']);
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo', '/path/to/workspace-folder1/repo/submodule1'], ['/path/to/workspace-folder1/repo/submodule2']);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/repo/submodule1': mockRepoState({ workspaceFolderIndex: 0 })
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('onWatcherCreate', () => {
		let repoManager: RepoManager;
		let emitOnDidCreate: (e: vscode.Uri) => any;
		let onDidChangeReposEvents: RepoChangeEvent[];
		let spyOnEnqueue: jest.SpyInstance;

		beforeEach(async () => {
			mockDirectoryThatsNotRepository();
			repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
			emitOnDidCreate = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidCreate).mock.calls[0][0];
			onDidChangeReposEvents = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			spyOnEnqueue = jest.spyOn(repoManager['onWatcherCreateQueue'], 'enqueue');
		});

		afterEach(() => {
			repoManager.dispose();
		});

		it('Should add a repository when a repository is added', async () => {
			// Setup
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();

			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherCreateQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherCreateQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo');
				expect(repoManager.getRepos()).toStrictEqual({
					'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
				});
				expect(onDidChangeReposEvents).toStrictEqual([
					{
						repos: {
							'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
						},
						numRepos: 1,
						loadRepo: null
					}
				]);
			});
		});

		it('Should add a repository when a .git directory is added', async () => {
			// Setup
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();

			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo/.git'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherCreateQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherCreateQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo');
				expect(repoManager.getRepos()).toStrictEqual({
					'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
				});
				expect(onDidChangeReposEvents).toStrictEqual([
					{
						repos: {
							'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
						},
						numRepos: 1,
						loadRepo: null
					}
				]);
			});
		});

		it('Should not proceed to add repositories when the directory added is within .git', () => {
			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo/.git/folder'));

			// Assert
			expect(spyOnEnqueue).not.toHaveBeenCalled();
		});

		it('Shouldn\'t add a repository when a file is added', async () => {
			// Setup
			mockFsStatOnce(null, false);

			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherCreateQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherCreateQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(repoManager.getRepos()).toStrictEqual({});
				expect(onDidChangeReposEvents).toStrictEqual([]);
			});
		});

		it('Shouldn\'t add a repository when a directory is added, but it doesn\'t contain any repositories', async () => {
			// Setup
			mockFsStatOnce(null, true);
			mockDirectoryThatsNotRepository();

			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherCreateQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherCreateQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(repoManager.getRepos()).toStrictEqual({});
				expect(onDidChangeReposEvents).toStrictEqual([]);
			});
		});
	});

	describe('onWatcherChange', () => {
		let repoManager: RepoManager;
		let emitOnDidChange: (e: vscode.Uri) => any;
		let onDidChangeReposEvents: RepoChangeEvent[];
		let spyOnEnqueue: jest.SpyInstance;

		beforeEach(async () => {
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			emitOnDidChange = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidChange).mock.calls[0][0];
			onDidChangeReposEvents = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			spyOnEnqueue = jest.spyOn(repoManager['onWatcherChangeQueue'], 'enqueue');
		});

		afterEach(() => {
			repoManager.dispose();
		});

		it('Should remove a repository when a repository is deleted', async () => {
			// Setup
			mockFsStatOnce(new Error(), true);

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherChangeQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherChangeQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo');
				expect(repoManager.getRepos()).toStrictEqual({});
				expect(onDidChangeReposEvents).toStrictEqual([
					{
						repos: {},
						numRepos: 0,
						loadRepo: null
					}
				]);
			});
		});

		it('Should remove a repository when a .git directory is deleted', async () => {
			// Setup
			mockFsStatOnce(new Error(), true);

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo/.git'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherChangeQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherChangeQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo');
				expect(repoManager.getRepos()).toStrictEqual({});
				expect(onDidChangeReposEvents).toStrictEqual([
					{
						repos: {},
						numRepos: 0,
						loadRepo: null
					}
				]);
			});
		});

		it('Should not proceed to remove a repository when the directory removed is within .git', () => {
			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo/.git/folder'));

			// Assert
			expect(spyOnEnqueue).not.toHaveBeenCalled();
		});

		it('Shouldn\'t remove a repository when a repository isn\'t deleted', async () => {
			// Setup
			mockFsStatOnce(null, true);

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherChangeQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherChangeQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/repo', expect.anything());
				expect(repoManager.getRepos()).toStrictEqual({
					'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
				});
				expect(onDidChangeReposEvents).toStrictEqual([]);
			});
		});

		it('Shouldn\'t remove a repository when a directory is removed, but it doesn\'t contain any repositories', async () => {
			// Setup
			mockFsStatOnce(new Error(), true);

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/dir/repo'));

			// Assert
			expect(spyOnEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/dir/repo');
			await waitForExpect(() => {
				expect(repoManager['onWatcherChangeQueue']['queue']).toStrictEqual([]);
				expect(repoManager['onWatcherChangeQueue']['processing']).toBe(false);
				expect(spyOnStat).toHaveBeenCalledWith('/path/to/workspace-folder1/dir/repo', expect.anything());
				expect(repoManager.getRepos()).toStrictEqual({
					'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
				});
				expect(onDidChangeReposEvents).toStrictEqual([]);
			});
		});
	});

	describe('onWatcherDelete', () => {
		it('Should delete repositories within a deleted directory', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/dir/repo1', '/path/to/workspace-folder1/dir/repo2', '/path/to/workspace-folder1/repo3']
			);

			const emitOnDidDelete = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidDelete).mock.calls[0][0];
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete(vscode.Uri.file('/path/to/workspace-folder1/dir'));

			// Assert
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/dir/repo1');
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/dir/repo2');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo3': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo3': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should delete repositories within a deleted repository', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo1/submodule', '/path/to/workspace-folder1/repo2']
			);

			const emitOnDidDelete = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidDelete).mock.calls[0][0];
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete(vscode.Uri.file('/path/to/workspace-folder1/repo1/.git'));

			// Assert
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo1');
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo1/submodule');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo2': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo2': mockRepoState({ workspaceFolderIndex: 0 })
					},
					numRepos: 1,
					loadRepo: null
				}
			]);

			// Teardown
			repoManager.dispose();
		});

		it('Should not proceed to remove repositories if the deleted URI is within .git', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/dir/repo1', '/path/to/workspace-folder1/dir/repo1/.git/folder/repo'] // Not realistic, this is used to observe the control flow for this test case
			);

			const emitOnDidDelete = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidDelete).mock.calls[0][0];
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete(vscode.Uri.file('/path/to/workspace-folder1/dir/repo1/.git/folder'));

			// Assert
			expect(spyOnLog).not.toHaveBeenCalledWith('/path/to/workspace-folder1/dir/repo1/.git/folder/repo');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/dir/repo1': mockRepoState({ workspaceFolderIndex: 0 }),
				'/path/to/workspace-folder1/dir/repo1/.git/folder/repo': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should not remove any repository if the deleted directory doesn\'t contain any repositories', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);

			const emitOnDidDelete = (<jest.Mock<any, any>>repoManager['folderWatchers']['/path/to/workspace-folder1'].onDidDelete).mock.calls[0][0];
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete(vscode.Uri.file('/path/to/workspace-folder1/dir'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('checkRepoForNewConfig', () => {
		describe('apply config', () => {
			const testApplyField = <K extends keyof GitRepoState, L extends keyof ExternalRepoConfig.File>(stateKey: K, stateValue: GitRepoState[K], fileKey: L, fileValue: ExternalRepoConfig.File[L]) => async () => {
				// Setup
				mockDirectoryThatsNotRepository();
				const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
				mockRepositoryWithNoSubmodules();
				const file: ExternalRepoConfig.File = {
					exportedAt: 1587559258000
				};
				file[fileKey] = fileValue;
				mockFsReadFileOnce(null, file);

				// Run
				await repoManager.registerRepo('/path/to/workspace-folder1/repo', false);

				// Assert
				const expected: GitRepoSet = {
					'/path/to/workspace-folder1/repo': {
						cdvDivider: 0.5,
						cdvHeight: 250,
						columnWidths: null,
						commitOrdering: RepoCommitOrdering.Default,
						fileViewType: FileViewType.Default,
						hideRemotes: [],
						includeCommitsMentionedByReflogs: BooleanOverride.Default,
						issueLinkingConfig: null,
						lastImportAt: 1587559258000,
						name: null,
						onlyFollowFirstParent: BooleanOverride.Default,
						onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
						onRepoLoadShowSpecificBranches: null,
						pullRequestConfig: null,
						showRemoteBranches: true,
						showRemoteBranchesV2: BooleanOverride.Default,
						showStashes: BooleanOverride.Default,
						showTags: BooleanOverride.Default,
						workspaceFolderIndex: 0
					}
				};
				expected['/path/to/workspace-folder1/repo'][stateKey] = stateValue;
				expect(repoManager.getRepos()).toStrictEqual(expected);
				expect(spyOnSaveRepos).toHaveBeenCalledWith(expected);
				expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(0);

				// Teardown
				repoManager.dispose();
			};

			describe('commitOrdering', () => {
				it('Should import RepoCommitOrdering.Date correctly', testApplyField('commitOrdering', RepoCommitOrdering.Date, 'commitOrdering', RepoCommitOrdering.Date));
				it('Should import RepoCommitOrdering.AuthorDate correctly', testApplyField('commitOrdering', RepoCommitOrdering.AuthorDate, 'commitOrdering', RepoCommitOrdering.AuthorDate));
				it('Should import RepoCommitOrdering.Topological correctly', testApplyField('commitOrdering', RepoCommitOrdering.Topological, 'commitOrdering', RepoCommitOrdering.Topological));
			});

			describe('fileViewType', () => {
				it('Should import FileViewType.Tree correctly', testApplyField('fileViewType', FileViewType.Tree, 'fileViewType', ExternalRepoConfig.FileViewType.Tree));
				it('Should import FileViewType.List correctly', testApplyField('fileViewType', FileViewType.List, 'fileViewType', ExternalRepoConfig.FileViewType.List));
			});

			describe('hideRemotes', () => {
				it('Should import hideRemotes correctly', testApplyField('hideRemotes', ['origin'], 'hideRemotes', ['origin']));
			});

			describe('includeCommitsMentionedByReflogs', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('includeCommitsMentionedByReflogs', BooleanOverride.Enabled, 'includeCommitsMentionedByReflogs', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('includeCommitsMentionedByReflogs', BooleanOverride.Disabled, 'includeCommitsMentionedByReflogs', false));
			});

			describe('issueLinkingConfig', () => {
				it('Should import issueLinkingConfig correctly', testApplyField('issueLinkingConfig', { issue: 'x', url: 'y' }, 'issueLinkingConfig', { issue: 'x', url: 'y' }));
			});

			describe('name', () => {
				it('Should import name correctly', testApplyField('name', 'Name', 'name', 'Name'));
			});

			describe('onlyFollowFirstParent', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('onlyFollowFirstParent', BooleanOverride.Enabled, 'onlyFollowFirstParent', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('onlyFollowFirstParent', BooleanOverride.Disabled, 'onlyFollowFirstParent', false));
			});

			describe('onRepoLoadShowCheckedOutBranch', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('onRepoLoadShowCheckedOutBranch', BooleanOverride.Enabled, 'onRepoLoadShowCheckedOutBranch', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('onRepoLoadShowCheckedOutBranch', BooleanOverride.Disabled, 'onRepoLoadShowCheckedOutBranch', false));
			});

			describe('onRepoLoadShowSpecificBranches', () => {
				it('Should import onRepoLoadShowSpecificBranches correctly', testApplyField('onRepoLoadShowSpecificBranches', ['master'], 'onRepoLoadShowSpecificBranches', ['master']));
			});

			describe('pullRequestConfig', () => {
				it('Should import a Bitbucket config correctly', testApplyField(
					'pullRequestConfig', { provider: PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
					'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
				));

				it('Should import a Custom config correctly', testApplyField(
					'pullRequestConfig', { provider: PullRequestProvider.Custom, custom: { name: 'Name', templateUrl: '$1/$2/$3/$4/$5/$6/$8' }, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
					'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom, custom: { name: 'Name', templateUrl: '$1/$2/$3/$4/$5/$6/$8' }, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
				));

				it('Should import a GitHub config correctly', testApplyField(
					'pullRequestConfig', { provider: PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
					'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
				));

				it('Should import a GitLab config correctly', testApplyField(
					'pullRequestConfig', { provider: PullRequestProvider.GitLab, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
					'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.GitLab, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
				));

				it('Should import a GitHub config with no destination remote correctly', testApplyField(
					'pullRequestConfig', { provider: PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: null, destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
					'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: null, destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
				));
			});

			describe('showRemoteBranches', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('showRemoteBranchesV2', BooleanOverride.Enabled, 'showRemoteBranches', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('showRemoteBranchesV2', BooleanOverride.Disabled, 'showRemoteBranches', false));
			});

			describe('showStashes', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('showStashes', BooleanOverride.Enabled, 'showStashes', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('showStashes', BooleanOverride.Disabled, 'showStashes', false));
			});

			describe('showTags', () => {
				it('Should import BooleanOverride.Enabled correctly', testApplyField('showTags', BooleanOverride.Enabled, 'showTags', true));
				it('Should import BooleanOverride.Disabled correctly', testApplyField('showTags', BooleanOverride.Disabled, 'showTags', false));
			});
		});

		describe('validation', () => {
			const testValidationOfField = (fileKey: string, fileValue: any) => async () => {
				// Setup
				mockDirectoryThatsNotRepository();
				const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
				mockRepositoryWithNoSubmodules();
				const file: any = {
					exportedAt: 1587559258000
				};
				file[fileKey] = fileValue;
				mockFsReadFileOnce(null, file);
				vscode.window.showErrorMessage.mockResolvedValueOnce(null);

				// Run
				await repoManager.registerRepo('/path/to/workspace-folder1/repo', false);

				// Assert
				expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('The value for "' + fileKey + '" in the configuration file "/path/to/workspace-folder1/repo/.vscode/vscode-git-graph.json" is invalid.');

				// Teardown
				repoManager.dispose();
			};

			it('Should display a validation error when "commitOrdering" is invalid', testValidationOfField('commitOrdering', 'invalid'));
			it('Should display a validation error when "fileViewType" is invalid', testValidationOfField('fileViewType', 'invalid'));
			it('Should display a validation error when "hideRemotes" is invalid (not an array)', testValidationOfField('hideRemotes', 'invalid'));
			it('Should display a validation error when "hideRemotes" is invalid (array doesn\'t contain strings)', testValidationOfField('hideRemotes', ['origin', 5]));
			it('Should display a validation error when "includeCommitsMentionedByReflogs" is invalid', testValidationOfField('includeCommitsMentionedByReflogs', 'invalid'));
			it('Should display a validation error when "issueLinkingConfig" is invalid (not an object)', testValidationOfField('issueLinkingConfig', 'invalid'));
			it('Should display a validation error when "issueLinkingConfig" is invalid (null)', testValidationOfField('issueLinkingConfig', null));
			it('Should display a validation error when "issueLinkingConfig" is invalid (no issue)', testValidationOfField('issueLinkingConfig', { url: 'x' }));
			it('Should display a validation error when "issueLinkingConfig" is invalid (no url)', testValidationOfField('issueLinkingConfig', { issue: 'x' }));
			it('Should display a validation error when "name" is invalid', testValidationOfField('name', 5));
			it('Should display a validation error when "onlyFollowFirstParent" is invalid', testValidationOfField('onlyFollowFirstParent', 'invalid'));
			it('Should display a validation error when "onRepoLoadShowCheckedOutBranch" is invalid', testValidationOfField('onRepoLoadShowCheckedOutBranch', 'invalid'));
			it('Should display a validation error when "onRepoLoadShowSpecificBranches" is invalid (not an array)', testValidationOfField('onRepoLoadShowSpecificBranches', 'invalid'));
			it('Should display a validation error when "onRepoLoadShowSpecificBranches" is invalid (array doesn\'t contain strings)', testValidationOfField('onRepoLoadShowSpecificBranches', ['master', 5]));
			it('Should display a validation error when "pullRequestConfig" is invalid (not an object)', testValidationOfField('pullRequestConfig', 'invalid'));
			it('Should display a validation error when "pullRequestConfig" is invalid (null)', testValidationOfField('pullRequestConfig', null));
			it('Should display a validation error when "pullRequestConfig" is invalid (unknown provider)', testValidationOfField('pullRequestConfig', { provider: 'invalid' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no custom provider config)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom }));
			it('Should display a validation error when "pullRequestConfig" is invalid (custom provider config is null)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom, custom: null }));
			it('Should display a validation error when "pullRequestConfig" is invalid (custom provider config is missing name)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom, custom: { templateUrl: 'x' } }));
			it('Should display a validation error when "pullRequestConfig" is invalid (custom provider config is missing templateUrl)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom, custom: { name: 'x' } }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no hostRootUrl)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no sourceRemote)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no sourceOwner)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no sourceRepo)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no destRemote)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no destOwner)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no destRepo)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: null, destOwner: 'f' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no destProjectId)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g' }));
			it('Should display a validation error when "pullRequestConfig" is invalid (no destBranch)', testValidationOfField('pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h' }));
			it('Should display a validation error when "showRemoteBranches" is invalid', testValidationOfField('showRemoteBranches', 'invalid'));
			it('Should display a validation error when "showStashes" is invalid', testValidationOfField('showStashes', 'invalid'));
			it('Should display a validation error when "showTags" is invalid', testValidationOfField('showTags', 'invalid'));
		});

		it('Shouldn\'t proceed with processing config if it couldn\'t be parsed', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
			const spyOnIsKnownRepo = jest.spyOn(repoManager, 'isKnownRepo');
			mockRepositoryWithNoSubmodules();
			mockFsReadFileOnce(null, '{');

			// Run
			await repoManager.registerRepo('/path/to/workspace-folder1/repo', false);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(spyOnIsKnownRepo).toHaveBeenCalledTimes(1);

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t proceed with processing config if it isn\'t an object', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
			const spyOnIsKnownRepo = jest.spyOn(repoManager, 'isKnownRepo');
			mockRepositoryWithNoSubmodules();
			mockFsReadFileOnce(null, 'true');

			// Run
			await repoManager.registerRepo('/path/to/workspace-folder1/repo', false);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': mockRepoState({ workspaceFolderIndex: 0 })
			});
			expect(spyOnIsKnownRepo).toHaveBeenCalledTimes(1);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('onConfigWatcherCreateOrChange', () => {
		it('Should import the repository configuration when the file is created', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			const emitOnDidCreate = (<jest.Mock<any, any>>repoManager['configWatcher'].onDidCreate).mock.calls[0][0];
			const spyOnBufferedQueueEnqueue = jest.spyOn(repoManager['checkRepoConfigQueue'], 'enqueue');
			mockFsReadFileOnce(null, {
				showTags: true,
				exportedAt: 1587559258000
			});
			vscode.window.showInformationMessage.mockResolvedValueOnce('Yes');
			vscode.window.showInformationMessage.mockResolvedValueOnce(null);

			// Run
			emitOnDidCreate(vscode.Uri.file('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json'));

			// Assert
			await waitForExpect(() => expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(2));
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('A newer Git Graph Repository Configuration File has been detected for the repository "repo1". Would you like to override your current repository configuration with the new changes?', 'Yes', 'No');
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Git Graph Repository Configuration was successfully imported for the repository "repo1".');
			expect(spyOnBufferedQueueEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo1');
		});

		it('Should import the repository configuration when the file is changed', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			repoManager['repos']['/path/to/workspace-folder1/repo1'].name = 'Old Name';
			const emitOnDidChange = (<jest.Mock<any, any>>repoManager['configWatcher'].onDidChange).mock.calls[0][0];
			const spyOnBufferedQueueEnqueue = jest.spyOn(repoManager['checkRepoConfigQueue'], 'enqueue');
			mockFsReadFileOnce(null, {
				name: 'Name',
				exportedAt: 1587559258000
			});
			vscode.window.showInformationMessage.mockResolvedValueOnce('Yes');
			vscode.window.showInformationMessage.mockResolvedValueOnce(null);

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json'));

			// Assert
			await waitForExpect(() => expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(2));
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('A newer Git Graph Repository Configuration File has been detected for the repository "Old Name". Would you like to override your current repository configuration with the new changes?', 'Yes', 'No');
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Git Graph Repository Configuration was successfully imported for the repository "Name".');
			expect(spyOnBufferedQueueEnqueue).toHaveBeenCalledWith('/path/to/workspace-folder1/repo1');
		});

		it('Shouldn\'t import the repository configuration when user responds "No"', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			const emitOnDidChange = (<jest.Mock<any, any>>repoManager['configWatcher'].onDidChange).mock.calls[0][0];
			const spyOnIsKnownRepo = jest.spyOn(repoManager, 'isKnownRepo');
			mockFsReadFileOnce(null, {
				name: 'Name',
				exportedAt: 1587559258000
			});
			vscode.window.showInformationMessage.mockResolvedValueOnce('No');
			spyOnSaveRepos.mockClear();

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json'));

			// Assert
			await waitForExpect(() => expect(spyOnIsKnownRepo).toHaveBeenCalledWith('/path/to/workspace-folder1/repo1'));
			const repoState = repoManager.getRepos()['/path/to/workspace-folder1/repo1'];
			expect(repoState.name).toBe(null);
			expect(repoState.lastImportAt).toBe(1587559258000);
			expect(spyOnSaveRepos).toHaveBeenCalledTimes(1);
		});

		it('Shouldn\'t import the repository configuration when user cancels the modal', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			const emitOnDidChange = (<jest.Mock<any, any>>repoManager['configWatcher'].onDidChange).mock.calls[0][0];
			const spyOnIsKnownRepo = jest.spyOn(repoManager, 'isKnownRepo');
			mockFsReadFileOnce(null, {
				name: 'Name',
				exportedAt: 1587559258000
			});
			vscode.window.showInformationMessage.mockResolvedValueOnce(undefined);
			spyOnSaveRepos.mockClear();

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json'));

			// Assert
			await waitForExpect(() => expect(spyOnIsKnownRepo).toHaveBeenCalledWith('/path/to/workspace-folder1/repo1'));
			expect(spyOnSaveRepos).not.toHaveBeenCalled();
		});

		it('Shouldn\'t import the repository configuration when it is not for a known repository', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			repoManager['repos']['/path/to/workspace-folder1/repo1'].name = 'Old Name';
			const emitOnDidChange = (<jest.Mock<any, any>>repoManager['configWatcher'].onDidChange).mock.calls[0][0];
			const spyOnBufferedQueueEnqueue = jest.spyOn(repoManager['checkRepoConfigQueue'], 'enqueue');

			// Run
			emitOnDidChange(vscode.Uri.file('/path/to/workspace-folder1/repo2/.vscode/vscode-git-graph.json'));

			// Assert
			expect(spyOnBufferedQueueEnqueue).not.toHaveBeenCalled();
		});
	});

	describe('exportRepoConfig', () => {
		it('Should export the repository configuration', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockWriteExternalConfigFileOnce();
			vscode.window.showInformationMessage.mockResolvedValueOnce(null);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			spyOnSaveRepos.mockClear();

			// Run
			const result = await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe(null);
			expect(utils.getPathFromStr(spyOnMkdir.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode');
			expect(utils.getPathFromStr(spyOnWriteFile.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json');
			expect(JSON.parse(spyOnWriteFile.mock.calls[0][1])).toStrictEqual({
				'exportedAt': 1587559258000
			});
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Successfully exported the Git Graph Repository Configuration to "/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json".');
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 1587559258000,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: 0
				}
			});

			// Teardown
			repoManager.dispose();
		});

		it('Should export the repository configuration, but not save the state change if the repository no longer exist', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockWriteExternalConfigFileOnce();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			vscode.window.showInformationMessage.mockImplementationOnce(() => {
				delete repoManager['repos']['/path/to/workspace-folder1/repo1'];
				return Promise.resolve();
			});
			spyOnSaveRepos.mockClear();

			// Run
			const result = await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe(null);
			expect(utils.getPathFromStr(spyOnMkdir.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode');
			expect(utils.getPathFromStr(spyOnWriteFile.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json');
			expect(JSON.parse(spyOnWriteFile.mock.calls[0][1])).toStrictEqual({
				'exportedAt': 1587559258000
			});
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Successfully exported the Git Graph Repository Configuration to "/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json".');
			expect(spyOnSaveRepos).not.toHaveBeenCalled();

			// Teardown
			repoManager.dispose();
		});

		it('Should export the repository configuration (when .vscode already exists)', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockFsMkdirOnce({ code: 'EEXIST' } as NodeJS.ErrnoException);
			mockFsWriteFileOnce(null);
			vscode.window.showInformationMessage.mockResolvedValueOnce(null);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			spyOnSaveRepos.mockClear();

			// Run
			const result = await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe(null);
			expect(utils.getPathFromStr(spyOnMkdir.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode');
			expect(utils.getPathFromStr(spyOnWriteFile.mock.calls[0][0])).toBe('/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json');
			expect(JSON.parse(spyOnWriteFile.mock.calls[0][1])).toStrictEqual({
				'exportedAt': 1587559258000
			});
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Successfully exported the Git Graph Repository Configuration to "/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json".');
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': {
					cdvDivider: 0.5,
					cdvHeight: 250,
					columnWidths: null,
					commitOrdering: RepoCommitOrdering.Default,
					fileViewType: FileViewType.Default,
					hideRemotes: [],
					includeCommitsMentionedByReflogs: BooleanOverride.Default,
					issueLinkingConfig: null,
					lastImportAt: 1587559258000,
					name: null,
					onlyFollowFirstParent: BooleanOverride.Default,
					onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
					onRepoLoadShowSpecificBranches: null,
					pullRequestConfig: null,
					showRemoteBranches: true,
					showRemoteBranchesV2: BooleanOverride.Default,
					showStashes: BooleanOverride.Default,
					showTags: BooleanOverride.Default,
					workspaceFolderIndex: 0
				}
			});

			// Teardown
			repoManager.dispose();
		});

		it('Should return an error message when .vscode can\'t be created', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockFsMkdirOnce(new Error());
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			spyOnSaveRepos.mockClear();

			// Run
			const result = await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe('An unexpected error occurred while checking if the "/path/to/workspace-folder1/repo1/.vscode" directory exists. This directory is used to store the Git Graph Repository Configuration file.');
			expect(spyOnSaveRepos).not.toHaveBeenCalled();

			// Teardown
			repoManager.dispose();
		});

		it('Should return an error message when the file can\'t be written', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockFsMkdirOnce(null);
			mockFsWriteFileOnce(new Error());
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);
			spyOnSaveRepos.mockClear();

			// Run
			const result = await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			expect(result).toBe('Failed to write the Git Graph Repository Configuration File to "/path/to/workspace-folder1/repo1/.vscode/vscode-git-graph.json".');
			expect(spyOnSaveRepos).not.toHaveBeenCalled();

			// Teardown
			repoManager.dispose();
		});

		const testExportField = <K extends keyof GitRepoState, L extends keyof ExternalRepoConfig.File>(stateKey: K, stateValue: GitRepoState[K], fileKey: L, fileValue: ExternalRepoConfig.File[L]) => async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockWriteExternalConfigFileOnce();
			vscode.window.showInformationMessage.mockResolvedValueOnce(null);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1']
			);
			repoManager.getRepos()['/path/to/workspace-folder1/repo1'][stateKey] = stateValue;

			// Run
			await repoManager.exportRepoConfig('/path/to/workspace-folder1/repo1');

			// Assert
			const expected: any = {};
			expected[fileKey] = fileValue;
			expected['exportedAt'] = 1587559258000;
			expect(JSON.parse(spyOnWriteFile.mock.calls[0][1])).toStrictEqual(expected);

			// Teardown
			repoManager.dispose();
		};

		describe('commitOrdering', () => {
			it('Should export RepoCommitOrdering.Date correctly', testExportField('commitOrdering', RepoCommitOrdering.Date, 'commitOrdering', RepoCommitOrdering.Date));
			it('Should export RepoCommitOrdering.AuthorDate correctly', testExportField('commitOrdering', RepoCommitOrdering.AuthorDate, 'commitOrdering', RepoCommitOrdering.AuthorDate));
			it('Should export RepoCommitOrdering.Topological correctly', testExportField('commitOrdering', RepoCommitOrdering.Topological, 'commitOrdering', RepoCommitOrdering.Topological));
		});

		describe('fileViewType', () => {
			it('Should export FileViewType.Tree correctly', testExportField('fileViewType', FileViewType.Tree, 'fileViewType', ExternalRepoConfig.FileViewType.Tree));
			it('Should export FileViewType.List correctly', testExportField('fileViewType', FileViewType.List, 'fileViewType', ExternalRepoConfig.FileViewType.List));
		});

		describe('hideRemotes', () => {
			it('Should export hideRemotes correctly', testExportField('hideRemotes', ['origin'], 'hideRemotes', ['origin']));
		});

		describe('includeCommitsMentionedByReflogs', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('includeCommitsMentionedByReflogs', BooleanOverride.Enabled, 'includeCommitsMentionedByReflogs', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('includeCommitsMentionedByReflogs', BooleanOverride.Disabled, 'includeCommitsMentionedByReflogs', false));
		});

		describe('issueLinkingConfig', () => {
			it('Should export issueLinkingConfig correctly', testExportField('issueLinkingConfig', { issue: 'x', url: 'y' }, 'issueLinkingConfig', { issue: 'x', url: 'y' }));
		});

		describe('name', () => {
			it('Should export name correctly', testExportField('name', 'Name', 'name', 'Name'));
		});

		describe('onlyFollowFirstParent', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('onlyFollowFirstParent', BooleanOverride.Enabled, 'onlyFollowFirstParent', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('onlyFollowFirstParent', BooleanOverride.Disabled, 'onlyFollowFirstParent', false));
		});

		describe('onRepoLoadShowCheckedOutBranch', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('onRepoLoadShowCheckedOutBranch', BooleanOverride.Enabled, 'onRepoLoadShowCheckedOutBranch', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('onRepoLoadShowCheckedOutBranch', BooleanOverride.Disabled, 'onRepoLoadShowCheckedOutBranch', false));
		});

		describe('onRepoLoadShowSpecificBranches', () => {
			it('Should export onRepoLoadShowSpecificBranches correctly', testExportField('onRepoLoadShowSpecificBranches', ['master'], 'onRepoLoadShowSpecificBranches', ['master']));
		});

		describe('pullRequestConfig', () => {
			it('Should export a Bitbucket config correctly', testExportField(
				'pullRequestConfig', { provider: PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
				'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Bitbucket, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
			));

			it('Should export a Custom config correctly', testExportField(
				'pullRequestConfig', { provider: PullRequestProvider.Custom, custom: { name: 'Name', templateUrl: '$1/$2/$3/$4/$5/$6/$8' }, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
				'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.Custom, custom: { name: 'Name', templateUrl: '$1/$2/$3/$4/$5/$6/$8' }, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
			));

			it('Should export a GitHub config correctly', testExportField(
				'pullRequestConfig', { provider: PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
				'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.GitHub, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
			));

			it('Should export a GitLab config correctly', testExportField(
				'pullRequestConfig', { provider: PullRequestProvider.GitLab, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' },
				'pullRequestConfig', { provider: ExternalRepoConfig.PullRequestProvider.GitLab, custom: null, hostRootUrl: 'a', sourceRemote: 'b', sourceOwner: 'c', sourceRepo: 'd', destRemote: 'e', destOwner: 'f', destRepo: 'g', destProjectId: 'h', destBranch: 'i' }
			));
		});

		describe('showRemoteBranches', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('showRemoteBranchesV2', BooleanOverride.Enabled, 'showRemoteBranches', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('showRemoteBranchesV2', BooleanOverride.Disabled, 'showRemoteBranches', false));
		});

		describe('showStashes', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('showStashes', BooleanOverride.Enabled, 'showStashes', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('showStashes', BooleanOverride.Disabled, 'showStashes', false));
		});

		describe('showTags', () => {
			it('Should export BooleanOverride.Enabled correctly', testExportField('showTags', BooleanOverride.Enabled, 'showTags', true));
			it('Should export BooleanOverride.Disabled correctly', testExportField('showTags', BooleanOverride.Disabled, 'showTags', false));
		});
	});
});

function mockRepository(generateRootPath?: (path: string) => string) {
	spyOnRepoRoot.mockImplementationOnce((path) => Promise.resolve(generateRootPath ? generateRootPath(path) : path));
}

function mockRepositoryWithSubmodules(submodules: string[]) {
	mockRepository();
	spyOnGetSubmodules.mockResolvedValueOnce(submodules);
}

function mockRepositoryWithNoSubmodules() {
	mockRepositoryWithSubmodules([]);
}

function mockDirectoryThatsNotRepository() {
	spyOnRepoRoot.mockResolvedValueOnce(null);
}

function mockFsReaddirOnce(err: NodeJS.ErrnoException | null, files: string[]) {
	spyOnReaddir.mockImplementationOnce((_: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void) => {
		callback(err, files);
	});
}

function mockFsStatOnce(err: NodeJS.ErrnoException | null, isDirectory: boolean) {
	spyOnStat.mockImplementationOnce((_: string, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
		callback(err, { isDirectory: () => isDirectory } as any as fs.Stats);
	});
}

function mockFsMkdirOnce(err: NodeJS.ErrnoException | null) {
	spyOnMkdir.mockImplementationOnce((_: string, callback: (err: NodeJS.ErrnoException | null) => void) => {
		callback(err);
	});
}

function mockFsReadFileOnce(err: NodeJS.ErrnoException | null, data: string | object) {
	spyOnReadFile.mockImplementationOnce((_: string, callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void) => {
		callback(err, Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)));
	});
}

function mockFsWriteFileOnce(err: NodeJS.ErrnoException | null) {
	spyOnWriteFile.mockImplementationOnce((_1: string, _2: any, callback: (err: NodeJS.ErrnoException | null) => void) => {
		callback(err);
	});
}

function mockWriteExternalConfigFileOnce() {
	mockFsMkdirOnce(null);
	mockFsWriteFileOnce(null);
}

function constructRepoManager(workspaceFolders: string[] | undefined, repos: string[] | GitRepoSet, ignoreRepos: string[] = []) {
	let repoSet: GitRepoSet = {};
	if (Array.isArray(repos)) {
		repos.forEach((repo) => repoSet[repo] = mockRepoState());
	} else {
		repoSet = Object.assign({}, repos);
	}

	spyOnGetRepos.mockReturnValueOnce(repoSet);

	spyOnGetIgnoredRepos.mockReturnValueOnce(ignoreRepos);

	vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 0);

	vscode.workspace.workspaceFolders = workspaceFolders
		? workspaceFolders.map((path, index) => ({ uri: vscode.Uri.file(path), index: index }))
		: undefined;

	return new RepoManager(dataSource, extensionState, onDidChangeConfiguration.subscribe, logger);
}

function waitForRepoManagerToStart() {
	return waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Completed searching workspace for new repos'));
}

async function constructRepoManagerAndWaitUntilStarted(workspaceFolders: string[] | undefined, repos: string[] | GitRepoSet, ignoreRepos: string[] = []) {
	const repoManager = constructRepoManager(workspaceFolders, repos, ignoreRepos);
	await waitForRepoManagerToStart();
	return repoManager;
}
