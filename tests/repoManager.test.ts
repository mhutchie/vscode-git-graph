import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('fs');
jest.mock('../src/dataSource');
jest.mock('../src/extensionState');
jest.mock('../src/logger');

import * as fs from 'fs';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { DEFAULT_REPO_STATE, ExtensionState } from '../src/extensionState';
import { Logger } from '../src/logger';
import { RepoChangeEvent, RepoManager } from '../src/repoManager';
import * as utils from '../src/utils';
import { EventEmitter } from '../src/utils/event';
import { FileViewType, GitRepoSet, IncludeCommitsMentionedByReflogs, OnlyFollowFirstParent, RepoCommitOrdering, ShowCheckedOutBranch, ShowRemoteBranches, ShowTags } from '../src/types';

let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<utils.GitExecutable>;
let logger: Logger;
let dataSource: DataSource;
let extensionState: ExtensionState;
let spyOnGetRepos: jest.SpyInstance, spyOnGetIgnoredRepos: jest.SpyInstance, spyOnSetIgnoredRepos: jest.SpyInstance, spyOnSaveRepos: jest.SpyInstance, spyOnTransferRepo: jest.SpyInstance, spyOnRepoRoot: jest.SpyInstance, spyOnGetSubmodules: jest.SpyInstance, spyOnLog: jest.SpyInstance, spyOnReaddir: jest.SpyInstance, spyOnStat: jest.SpyInstance;

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
	spyOnReaddir = jest.spyOn(fs, 'readdir');
	spyOnStat = jest.spyOn(fs, 'stat');
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
		expect(repoManager['disposables']).toHaveLength(4);

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
			await emitOnDidChangeWorkspaceFolders!({ added: [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }], removed: [] });

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1');
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenLastCalledWith('/path/to/workspace-folder1/**');

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
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': DEFAULT_REPO_STATE
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
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

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
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder2': DEFAULT_REPO_STATE
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
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			mockDirectoryThatsNotRepository();

			// Run
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2', '/path/to/workspace-folder2']
			);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE
			});
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenLastCalledWith('/path/to/workspace-folder1/**');

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
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
			});
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
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
					'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
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
				'/path/to': DEFAULT_REPO_STATE
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('registerRepo', () => {
		it('Should register a new repository', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			mockRepositoryWithNoSubmodules();
			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			const result = await repoManager.registerRepo('/path/to/workspace-folder1/repo', false);

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
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: null
				}
			]);

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
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
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
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: '/path/to/workspace-folder1/repo'
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
		it('Should get the sorted set of repositories', async () => {
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
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo2': DEFAULT_REPO_STATE
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
						'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE
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
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockRepository();
			mockRepository((path) => path + '-new');

			// Run
			const result = await repoManager.checkReposExist();

			// Assert
			expect(result).toBe(true);
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo2-new': DEFAULT_REPO_STATE
			});
			expect(spyOnTransferRepo).toHaveBeenCalledWith('/path/to/workspace-folder1/repo2', '/path/to/workspace-folder1/repo2-new');
			expect(spyOnLog).toHaveBeenCalledWith('Transferred repo state: /path/to/workspace-folder1/repo2 -> /path/to/workspace-folder1/repo2-new');
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
						'/path/to/workspace-folder1/repo2-new': DEFAULT_REPO_STATE
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
				includeCommitsMentionedByReflogs: IncludeCommitsMentionedByReflogs.Default,
				issueLinkingConfig: null,
				name: null,
				onlyFollowFirstParent: OnlyFollowFirstParent.Default,
				onRepoLoadShowCheckedOutBranch: ShowCheckedOutBranch.Default,
				onRepoLoadShowSpecificBranches: null,
				pullRequestConfig: null,
				showRemoteBranches: true,
				showRemoteBranchesV2: ShowRemoteBranches.Default,
				showTags: ShowTags.Default
			};

			// Run
			repoManager.setRepoState('/path/to/workspace-folder1/repo2', newRepoState);

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo2': newRepoState
			});
			expect(spyOnSaveRepos).toHaveBeenCalledWith({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
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
				'/path/to/workspace-folder1': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1': DEFAULT_REPO_STATE
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
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
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
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo/submodule1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo/submodule2': DEFAULT_REPO_STATE
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
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo/submodule1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo/submodule2': DEFAULT_REPO_STATE
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
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo/submodule1': DEFAULT_REPO_STATE
			});

			// Teardown
			repoManager.dispose();
		});
	});

	describe('onWatcherCreate', () => {
		it('Should add a repository when a repository is added', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo'));
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should add a repository when a .git directory is added', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo/.git'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo'));
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should not proceed to add repositories when the directory added is within .git', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);
			jest.useFakeTimers();

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo/.git/folder'));

			// Assert
			expect(jest.getTimerCount()).toBe(0);

			// Teardown
			repoManager.dispose();
			jest.useRealTimers();
		});

		it('Shouldn\'t add duplicate create events to the queue', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo'));
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
					},
					numRepos: 1,
					loadRepo: null
				}
			]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should maintain a single debounce timeout', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();
			mockFsStatOnce(null, true);
			mockRepositoryWithNoSubmodules();
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo1'));
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo2'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']);
			expect(jest.getTimerCount()).toBe(1);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => {
				expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo1');
				expect(spyOnLog).toHaveBeenCalledWith('Added new repo: /path/to/workspace-folder1/repo2');
			});
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/repo2': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE,
						'/path/to/workspace-folder1/repo2': DEFAULT_REPO_STATE
					},
					numRepos: 2,
					loadRepo: null
				}
			]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t set a processing timeout if processingCreateEvents === TRUE', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			repoManager['processingCreateEvents'] = true;
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);
			expect(jest.getTimerCount()).toBe(0);

			// Teardown
			repoManager.dispose();
			jest.useRealTimers();
		});

		it('Shouldn\'t add a repository when a file is added', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, false);
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(repoManager['processingCreateEvents']).toBe(false));
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t add a repository when a directory is added, but it doesn\'t contain any repositories', async () => {
			// Setup
			mockDirectoryThatsNotRepository();
			let emitOnDidCreate: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidCreate.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidCreate = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], []);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			mockDirectoryThatsNotRepository();
			jest.useFakeTimers();

			// Run
			emitOnDidCreate!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['createEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(repoManager['processingCreateEvents']).toBe(false));
			expect(repoManager.getRepos()).toStrictEqual({});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(repoManager['createEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('onWatcherChange', () => {
		it('Should remove a repository when a repository is deleted', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(new Error(), true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo'));
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

		it('Should remove a repository when a .git directory is deleted', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(new Error(), true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo/.git'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo'));
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

		it('Should not proceed to remove a repository when the directory removed is within .git', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo/.git/folder'));

			// Assert
			expect(jest.getTimerCount()).toBe(0);

			// Teardown
			repoManager.dispose();
			jest.useRealTimers();
		});

		it('Shouldn\'t add duplicate change events to the queue', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(new Error(), true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo'));
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo'));
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

		it('Should maintain a single debounce timeout', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(new Error(), true);
			mockFsStatOnce(new Error(), true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo1'));
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo2'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo2']);
			expect(jest.getTimerCount()).toBe(1);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => {
				expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo1');
				expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo2');
			});
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

		it('Shouldn\'t set a processing timeout if processingCreateEvents === TRUE', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			repoManager['processingChangeEvents'] = true;
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);
			expect(jest.getTimerCount()).toBe(0);

			// Teardown
			repoManager.dispose();
			jest.useRealTimers();
		});

		it('Shouldn\'t remove a repository when a repository isn\'t deleted', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(null, true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/repo'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(repoManager['processingChangeEvents']).toBe(false));
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(repoManager['changeEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Shouldn\'t remove a repository when a directory is removed, but it doesn\'t contain any repositories', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidChange: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidChange.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidChange = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));
			mockFsStatOnce(new Error(), true);
			jest.useFakeTimers();

			// Run
			emitOnDidChange!(vscode.Uri.file('/path/to/workspace-folder1/dir/repo'));

			// Assert
			expect(repoManager['changeEventQueue']).toStrictEqual(['/path/to/workspace-folder1/dir/repo']);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(repoManager['processingChangeEvents']).toBe(false));
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);
			expect(repoManager['changeEventQueue']).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});
	});

	describe('onWatcherDelete', () => {
		it('Should delete repositories within a deleted directory', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidDelete: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidDelete.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidDelete = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/dir/repo1', '/path/to/workspace-folder1/dir/repo2', '/path/to/workspace-folder1/repo3']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete!(vscode.Uri.file('/path/to/workspace-folder1/dir'));

			// Assert
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/dir/repo1');
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/dir/repo2');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo3': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo3': DEFAULT_REPO_STATE
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
			let emitOnDidDelete: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidDelete.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidDelete = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/repo1', '/path/to/workspace-folder1/repo1/submodule', '/path/to/workspace-folder1/repo2']
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete!(vscode.Uri.file('/path/to/workspace-folder1/repo1/.git'));

			// Assert
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo1');
			expect(spyOnLog).toHaveBeenCalledWith('Removed repo: /path/to/workspace-folder1/repo1/submodule');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo2': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([
				{
					repos: {
						'/path/to/workspace-folder1/repo2': DEFAULT_REPO_STATE
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
			let emitOnDidDelete: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidDelete.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidDelete = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(
				['/path/to/workspace-folder1'],
				['/path/to/workspace-folder1/dir/repo1', '/path/to/workspace-folder1/dir/repo1/.git/folder/repo'] // Not realistic, this is used to observe the control flow for this test case
			);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete!(vscode.Uri.file('/path/to/workspace-folder1/dir/repo1/.git/folder'));

			// Assert
			expect(spyOnLog).not.toHaveBeenCalledWith('/path/to/workspace-folder1/dir/repo1/.git/folder/repo');
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/dir/repo1': DEFAULT_REPO_STATE,
				'/path/to/workspace-folder1/dir/repo1/.git/folder/repo': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
		});

		it('Should not remove any repository if the deleted directory doesn\'t contain any repositories', async () => {
			// Setup
			mockRepositoryWithNoSubmodules();
			mockDirectoryThatsNotRepository();
			let emitOnDidDelete: (e: vscode.Uri) => any;
			vscode.mocks.fileSystemWater.onDidDelete.mockImplementationOnce((listener: (e: vscode.Uri) => any) => emitOnDidDelete = listener);
			const repoManager = await constructRepoManagerAndWaitUntilStarted(['/path/to/workspace-folder1'], ['/path/to/workspace-folder1/repo1']);

			const onDidChangeReposEvents: RepoChangeEvent[] = [];
			repoManager.onDidChangeRepos((event) => onDidChangeReposEvents.push(event));

			// Run
			emitOnDidDelete!(vscode.Uri.file('/path/to/workspace-folder1/dir'));

			// Assert
			expect(repoManager.getRepos()).toStrictEqual({
				'/path/to/workspace-folder1/repo1': DEFAULT_REPO_STATE
			});
			expect(onDidChangeReposEvents).toStrictEqual([]);

			// Teardown
			repoManager.dispose();
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

function waitForExpect(expect: () => void) {
	return new Promise((resolve, reject) => {
		let attempts = 0;
		const testInterval = setInterval(async () => {
			try {
				attempts++;
				expect();
				resolve();
			} catch (e) {
				if (attempts === 100) {
					clearInterval(testInterval);
					reject(e);
				}
			}
		}, 50);
	});
}

async function constructRepoManagerAndWaitUntilStarted(workspaceFolders: string[] | undefined, repos: string[], ignoreRepos: string[] = []) {
	const repoSet: GitRepoSet = {};
	repos.forEach((repo) => repoSet[repo] = DEFAULT_REPO_STATE);
	spyOnGetRepos.mockReturnValueOnce(repoSet);

	spyOnGetIgnoredRepos.mockReturnValueOnce(ignoreRepos);

	vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 0);

	vscode.workspace.workspaceFolders = workspaceFolders
		? workspaceFolders.map((path) => ({ uri: vscode.Uri.file(path) }))
		: undefined;

	const repoManager = new RepoManager(dataSource, extensionState, onDidChangeConfiguration.subscribe, logger);

	await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('Completed searching workspace for new repos'));

	return repoManager;
}
