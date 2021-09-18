import * as date from './mocks/date';
import { mockSpyOnSpawn } from './mocks/spawn';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/askpass/askpassManager');
jest.mock('../src/logger');

import * as cp from 'child_process';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import * as path from 'path';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource, GitConfigKey } from '../src/dataSource';
import { Logger } from '../src/logger';
import { CommitOrdering, GitConfigLocation, GitPushBranchMode, GitResetMode, GitSignature, GitSignatureStatus, MergeActionOn, RebaseActionOn, TagType } from '../src/types';
import * as utils from '../src/utils';
import { EventEmitter } from '../src/utils/event';

import { waitForExpect } from './helpers/expectations';

const workspaceConfiguration = vscode.mocks.workspaceConfiguration;
let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<utils.GitExecutable>;
let logger: Logger;
let spyOnSpawn: jest.SpyInstance, spyOnLog: jest.SpyInstance, spyOnLogError: jest.SpyInstance;

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<utils.GitExecutable>();
	logger = new Logger();
	jest.spyOn(path, 'normalize').mockImplementation((p) => p);
	spyOnSpawn = jest.spyOn(cp, 'spawn');
	spyOnLog = jest.spyOn(logger, 'log');
	spyOnLogError = jest.spyOn(logger, 'logError');
});

afterAll(() => {
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

describe('DataSource', () => {
	let dataSource: DataSource;
	beforeEach(() => {
		dataSource = new DataSource({ path: '/path/to/git', version: '2.25.0' }, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
	});
	afterEach(() => {
		dataSource.dispose();
	});

	const mockGitSuccessOnce = (stdout?: string, stderr?: string) => {
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			if (stdout) {
				stdoutOnCallbacks['data'](Buffer.from(stdout));
			}
			stdoutOnCallbacks['close']();
			if (stderr) {
				stderrOnCallbacks['data'](Buffer.from(stderr));
			}
			stderrOnCallbacks['close']();
			onCallbacks['exit'](0);
		});
	};

	const mockGitThrowingErrorOnce = (errorMessage?: string) => {
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['data']((errorMessage || 'error message') + '\n');
			stderrOnCallbacks['close']();
			onCallbacks['exit'](1);
		});
	};

	describe('isGitExecutableUnknown', () => {
		it('Should return FALSE when the Git executable is known', () => {
			// Run
			const result = dataSource.isGitExecutableUnknown();

			// Assert
			expect(result).toBe(false);
		});

		it('Should return TRUE when the Git executable is unknown', () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = dataSource.isGitExecutableUnknown();

			// Assert
			expect(result).toBe(true);
		});

		it('Should return TRUE after a Git executable becomes known', () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result1 = dataSource.isGitExecutableUnknown();

			// Assert
			expect(result1).toBe(true);

			// Run
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.25.0' });
			const result2 = dataSource.isGitExecutableUnknown();

			// Assert
			expect(result2).toBe(false);
			expect(dataSource['gitExecutable']).toStrictEqual({ path: '/path/to/git', version: '2.25.0' });
		});
	});

	describe('setGitExecutable', () => {
		it('Should set gitExecutableSupportsGpgInfo to FALSE when there is no Git executable', () => {
			// Run
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Assert
			expect(dataSource['gitExecutableSupportsGpgInfo']).toBe(false);
		});

		it('Should set gitExecutableSupportsGpgInfo to FALSE when the Git executable is older than 2.4.0', () => {
			// Run
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.3.0' });

			// Assert
			expect(dataSource['gitExecutableSupportsGpgInfo']).toBe(false);
		});

		it('Should set gitExecutableSupportsGpgInfo to TRUE when the Git executable is at least 2.4.0', () => {
			// Run
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.4.0' });

			// Assert
			expect(dataSource['gitExecutableSupportsGpgInfo']).toBe(true);
		});
	});

	describe('getRepoInfo', () => {
		it('Should return the repository info', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n' +
				'  remotes/origin/HEAD\n' +
				'  remotes/origin/develop\n' +
				'  remotes/origin/master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce(
				'98adab72e57a098a45cc36e43a6c0fda95c44f8bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbb30d6d4d14462e09515df02a8635e83b4278c8b1 26970361eca306caa6d6bed3baf022dbd8fa404cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbrefs/stash@{0}XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1592306634XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbWIP on develop: b30d6d4 y\n' +
				'0fc3e571c275213de2b3bca9c85e852323056121XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb9157723d0856bd828800ff185ee72658ee51d19f d45009bc4224537e97b0e52883ea7ae657928fcf 9d81ce0a6cf64b6651bacd7a6c3a6ca90fd63235XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbrefs/stash@{1}XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1592135134XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbWIP on master: 9157723 y\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master', 'remotes/origin/HEAD', 'remotes/origin/develop', 'remotes/origin/master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [
					{
						author: 'Test Author',
						baseHash: 'b30d6d4d14462e09515df02a8635e83b4278c8b1',
						date: 1592306634,
						email: 'test@mhutchie.com',
						hash: '98adab72e57a098a45cc36e43a6c0fda95c44f8b',
						message: 'WIP on develop: b30d6d4 y',
						selector: 'refs/stash@{0}',
						untrackedFilesHash: null
					},
					{
						author: 'Test Author',
						baseHash: '9157723d0856bd828800ff185ee72658ee51d19f',
						date: 1592135134,
						email: 'test@mhutchie.com',
						hash: '0fc3e571c275213de2b3bca9c85e852323056121',
						message: 'WIP on master: 9157723 y',
						selector: 'refs/stash@{1}',
						untrackedFilesHash: '9d81ce0a6cf64b6651bacd7a6c3a6ca90fd63235'
					}
				],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-a', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (when showRemoteBranches is FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', false, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (using git-graph.date.type)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('date.type', 'Commit Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', false);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', false);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.date.type'
			});
			const result = await dataSource.getRepoInfo('/path/to/repo', false, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (using git-graph.dateType)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('date.type', 'Commit Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', false);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', false);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.dateType'
			});
			const result = await dataSource.getRepoInfo('/path/to/repo', false, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (using git-graph.repository.useMailmap)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', true);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', false);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.repository.useMailmap'
			});
			const result = await dataSource.getRepoInfo('/path/to/repo', false, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aNXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aEXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (using git-graph.useMailmap)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('useMailmap', true);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', false);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.useMailmap'
			});
			const result = await dataSource.getRepoInfo('/path/to/repo', false, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aNXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aEXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (showStashes is FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, false, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-a', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toHaveBeenCalledTimes(2);
		});

		it('Should return the repository info (hidden remote and an invalid branch)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n' +
				'  (invalid branch)\n' +
				'  remotes/origin/develop\n' +
				'  remotes/origin/master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, ['origin']);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-a', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repository info (excluding remote heads)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n' +
				'  remotes/origin/HEAD\n' +
				'  remotes/origin/develop\n' +
				'  remotes/origin/master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', false);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master', 'remotes/origin/develop', 'remotes/origin/master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-a', '--no-color'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reflog', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%gDXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', 'refs/stash', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when getting branches)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: [],
				head: null,
				remotes: [],
				stashes: [],
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when getting remotes)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce('\n');
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: [],
				head: null,
				remotes: [],
				stashes: [],
				error: 'error message'
			});
		});

		it('Should return no stashes when when getting stashes throws an error', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [],
				error: null
			});
		});
	});

	describe('getCommits', () => {
		it('Should return the commits (show all branches)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/other-remote/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/tags/tag2\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [
							{ name: 'origin/HEAD', remote: 'origin' },
							{ name: 'origin/master', remote: 'origin' },
							{ name: 'other-remote/master', remote: null }
						],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1', 'tag2'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (master & develop branches)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', ['master', 'develop'], 300, true, true, false, false, CommitOrdering.AuthorDate, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--author-date-order', 'master', 'develop', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (no more commits)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 2, true, true, false, false, CommitOrdering.Topological, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: [],
				moreCommitsAvailable: true,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=3', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--topo-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (HEAD is not in the commits)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showUncommittedChanges === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', false);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showUntrackedFiles === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', false);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (1)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=no', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showTags === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, false, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showCommitsOnlyReferencedByTags === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', false);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showRemoteBranches === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, false, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '--heads', '--tags', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (includeCommitsMentionedByReflogs === TRUE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, true, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--reflog', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (onlyFollowFirstParent === TRUE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, true, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--first-parent', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (showRemoteHeads === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/other-remote/HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/other-remote/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', false);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [
							{ name: 'origin/master', remote: 'origin' },
							{ name: 'other-remote/master', remote: null }
						],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (hiding the remote branches from a hidden remote)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/other-remote/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin', 'other-remote'], ['other-remote'], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--glob=refs/remotes/origin', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (stash returned in git log commits)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbWIP\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c HEAD\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], [
				{
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					baseHash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
					untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f',
					selector: 'refs/stash@{0}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559258,
					message: 'WIP'
				}
			]);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'WIP',
						heads: [],
						tags: [],
						remotes: [],
						stash: {
							baseHash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
							selector: 'refs/stash@{0}',
							untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f'
						}
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['master', 'develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (stashes are based on different commits returned by git log)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], [
				{
					hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
					baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f',
					selector: 'refs/stash@{0}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559258,
					message: 'WIP 1'
				},
				{
					hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
					baseHash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
					untrackedFilesHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a',
					selector: 'refs/stash@{1}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559258,
					message: 'WIP 2'
				}
			]);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: 'Test Stash Author',
						email: 'test-stash@mhutchie.com',
						date: 1587559258,
						message: 'WIP 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: {
							baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
							selector: 'refs/stash@{0}',
							untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f'
						}
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Stash Author',
						email: 'test-stash@mhutchie.com',
						date: 1587559258,
						message: 'WIP 2',
						heads: [],
						tags: [],
						remotes: [],
						stash: {
							baseHash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
							selector: 'refs/stash@{1}',
							untrackedFilesHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a'
						}
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: [],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (stashes are based on a commit returned by git log)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], [
				{
					hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
					baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f',
					selector: 'refs/stash@{0}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559261,
					message: 'WIP 1'
				},
				{
					hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
					baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					untrackedFilesHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a',
					selector: 'refs/stash@{1}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559260,
					message: 'WIP 2'
				}
			]);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: 'Test Stash Author',
						email: 'test-stash@mhutchie.com',
						date: 1587559261,
						message: 'WIP 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: {
							baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
							selector: 'refs/stash@{0}',
							untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f'
						}
					},
					{
						hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: 'Test Stash Author',
						email: 'test-stash@mhutchie.com',
						date: 1587559260,
						message: 'WIP 2',
						heads: [],
						tags: [],
						remotes: [],
						stash: {
							baseHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
							selector: 'refs/stash@{1}',
							untrackedFilesHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a'
						}
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: [],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (stash isn\'t based on a commit returned by git log)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], [
				{
					hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
					baseHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a',
					untrackedFilesHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f',
					selector: 'refs/stash@{0}',
					author: 'Test Stash Author',
					email: 'test-stash@mhutchie.com',
					date: 1587559258,
					message: 'WIP 1'
				}
			]);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: [],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commits (no uncommitted changes)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce('');
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return no commits (when in an empty repository)', async () => {
			// Setup
			mockGitSuccessOnce('\n');
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [],
				head: null,
				tags: [],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(2);
		});

		it('Should return the commits (ignoring invalid show-ref records)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/invalid/master\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/remotes/origin/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/other-remote/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			mockGitSuccessOnce(
				'M modified.txt\n' +
				'?? untracked.txt\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);
			vscode.mockExtensionSettingReturnValue('repository.showUncommittedChanges', true);
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);
			date.setCurrentTime(1587559259);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [
					{
						hash: '*',
						parents: ['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'],
						author: '*',
						email: '',
						date: 1587559259,
						message: 'Uncommitted Changes (2)',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					},
					{
						hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
						parents: ['2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559258,
						message: 'Commit Message 3',
						heads: ['master'],
						tags: [],
						remotes: [{ name: 'origin/master', remote: 'origin' }, { name: 'other-remote/master', remote: null }],
						stash: null
					},
					{
						hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c',
						parents: ['3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d'],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559257,
						message: 'Commit Message 2',
						heads: ['develop'],
						tags: [{ name: 'tag1', annotated: true }],
						remotes: [],
						stash: null
					},
					{
						hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
						parents: [],
						author: 'Test Name',
						email: 'test@mhutchie.com',
						date: 1587559256,
						message: 'Commit Message 1',
						heads: [],
						tags: [],
						remotes: [],
						stash: null
					}
				],
				head: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
				tags: ['tag1'],
				moreCommitsAvailable: false,
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--max-count=301', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%s', '--date-order', '--branches', '--tags', '--remotes', 'HEAD', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show-ref', '-d', '--head'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '--untracked-files=all', '--porcelain'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when thrown by git log)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b HEAD\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/heads/master\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/heads/develop\n' +
				'4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e refs/heads/feature\n' +
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b refs/remotes/origin/master\n' +
				'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/tags/tag1\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c refs/tags/tag1^{}\n'
			);
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [],
				head: null,
				tags: [],
				moreCommitsAvailable: false,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git show-ref)', async () => {
			// Setup
			mockGitSuccessOnce(
				'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 3\n' +
				'2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559257XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 2\n' +
				'3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4dXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest NameXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559256XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message 1\n'
			);
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.showCommitsOnlyReferencedByTags', true);
			vscode.mockExtensionSettingReturnValue('repository.showRemoteHeads', true);

			// Run
			const result = await dataSource.getCommits('/path/to/repo', null, 300, true, true, false, false, CommitOrdering.Date, ['origin'], [], []);

			// Assert
			expect(result).toStrictEqual({
				commits: [],
				head: null,
				tags: [],
				moreCommitsAvailable: false,
				error: 'error message'
			});
		});
	});

	describe('getConfig', () => {
		it('Should return the config values', async () => {
			// Setup
			mockGitSuccessOnce(
				'user.name\nLocal Name\0' +
				'diff.tool\nabc\0' +
				'diff.guitool\ndef\0' +
				'remote.pushdefault\norigin\0'
			);
			mockGitSuccessOnce(
				'user.name\nLocal Name\0' +
				'user.email\nunused@mhutchie.com\0' +
				'user.email\nlocal@mhutchie.com\0' +
				'remote.origin.url\nhttps://github.com/mhutchie/vscode-git-graph.git\0' +
				'remote.origin.pushurl\nhttps://github.com/mhutchie/vscode-git-graph-push.git\0' +
				'remote.origin.fetch\n+refs/heads/*:refs/remotes/origin/*\0' +
				'branch.master.remote\norigin\0' +
				'branch.master.pushremote\norigin2\0' +
				'branch.master.other\norigin3\0' +
				'branch.develop.pushremote\norigin\0' +
				'branch.develop.remote\norigin2\0' +
				'branch.branch1.remote\norigin\0' +
				'branch.branch2.pushremote\norigin\0'
			);
			mockGitSuccessOnce(
				'user.name\nGlobal Name\0' +
				'user.email\nglobal@mhutchie.com\0'
			);

			// Run
			const result = await dataSource.getConfig('/path/to/repo', ['origin']);

			// Assert
			expect(result).toStrictEqual({
				config: {
					branches: {
						master: {
							pushRemote: 'origin2',
							remote: 'origin'
						},
						develop: {
							pushRemote: 'origin',
							remote: 'origin2'
						},
						branch1: {
							pushRemote: null,
							remote: 'origin'
						},
						branch2: {
							pushRemote: 'origin',
							remote: null
						}
					},
					diffTool: 'abc',
					guiDiffTool: 'def',
					pushDefault: 'origin',
					remotes: [
						{
							name: 'origin',
							url: 'https://github.com/mhutchie/vscode-git-graph.git',
							pushUrl: 'https://github.com/mhutchie/vscode-git-graph-push.git'
						}
					],
					user: {
						name: {
							local: 'Local Name',
							global: 'Global Name'
						},
						email: {
							local: 'local@mhutchie.com',
							global: 'global@mhutchie.com'
						}
					}
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the config values', async () => {
			// Setup
			mockGitSuccessOnce(
				'diff.tool\nabc\0' +
				'diff.guitool\ndef\0'
			);
			mockGitSuccessOnce(
				'user.email\nlocal@mhutchie.com\0' +
				'remote.origin.url\nhttps://github.com/mhutchie/vscode-git-graph.git\0'
			);
			mockGitSuccessOnce(
				'user.name\nGlobal Name\0'
			);

			// Run
			const result = await dataSource.getConfig('/path/to/repo', ['origin']);

			// Assert
			expect(result).toStrictEqual({
				config: {
					branches: {},
					diffTool: 'abc',
					guiDiffTool: 'def',
					pushDefault: null,
					remotes: [
						{
							name: 'origin',
							url: 'https://github.com/mhutchie/vscode-git-graph.git',
							pushUrl: null
						}
					],
					user: {
						name: {
							local: null,
							global: 'Global Name'
						},
						email: {
							local: 'local@mhutchie.com',
							global: null
						}
					}
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return NULL values when the config variables aren\'t set', async () => {
			// Setup
			mockGitSuccessOnce(
				'other.setting\nvalue\0'
			);
			mockGitSuccessOnce(
				'other.setting\nvalue\0'
			);
			mockGitSuccessOnce(
				'other.setting\nvalue\0'
			);

			// Run
			const result = await dataSource.getConfig('/path/to/repo', []);

			// Assert
			expect(result).toStrictEqual({
				config: {
					branches: {},
					diffTool: null,
					guiDiffTool: null,
					pushDefault: null,
					remotes: [],
					user: {
						name: {
							local: null,
							global: null
						},
						email: {
							local: null,
							global: null
						}
					}
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repositories settings (ignoring Git exception when either the global or local .gitconfig file doesn\'t exist)', async () => {
			// Setup
			mockGitSuccessOnce(
				'user.name\nLocal Name\0' +
				'diff.tool\nabc\0' +
				'diff.guitool\ndef\0'
			);
			mockGitSuccessOnce(
				'user.name\nLocal\r\nMultiline\nName\0' +
				'user.email\nunused@mhutchie.com\0' +
				'user.email\nlocal@mhutchie.com\0' +
				'remote.origin.url\nhttps://github.com/mhutchie/vscode-git-graph.git\0' +
				'remote.origin.pushurl\nhttps://github.com/mhutchie/vscode-git-graph-push.git\0' +
				'remote.origin.fetch\n+refs/heads/*:refs/remotes/origin/*\0'
			);
			mockGitThrowingErrorOnce('fatal: unable to read config file \'c:/users/michael/.gitconfig\': no such file or directory');

			// Run
			const result = await dataSource.getConfig('/path/to/repo', ['origin']);

			// Assert
			expect(result).toStrictEqual({
				config: {
					branches: {},
					diffTool: 'abc',
					guiDiffTool: 'def',
					pushDefault: null,
					remotes: [
						{
							name: 'origin',
							url: 'https://github.com/mhutchie/vscode-git-graph.git',
							pushUrl: 'https://github.com/mhutchie/vscode-git-graph-push.git'
						}
					],
					user: {
						name: {
							local: 'Local\nMultiline\nName',
							global: null
						},
						email: {
							local: 'local@mhutchie.com',
							global: null
						}
					}
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '-z', '--includes', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitThrowingErrorOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getConfig('/path/to/repo', []);

			// Assert
			expect(result).toStrictEqual({
				config: null,
				error: 'error message'
			});
		});

		it('Should return an error message indicating an unexpected error occurred', async () => {
			// Setup
			const error = new Error();
			mockGitSuccessOnce(
				'user.name\nLocal Name\0' +
				'diff.tool\nabc\0' +
				'diff.guitool\ndef\0'
			);
			mockGitSuccessOnce(
				'user.name\nLocal Name\0' +
				'user.email\nunused@mhutchie.com\0' +
				'user.email\nlocal@mhutchie.com\0' +
				'remote.origin.url\nhttps://github.com/mhutchie/vscode-git-graph.git\0' +
				'remote.origin.pushurl\nhttps://github.com/mhutchie/vscode-git-graph-push.git\0' +
				'remote.origin.fetch\n+refs/heads/*:refs/remotes/origin/*\0'
			);
			spyOnSpawn.mockImplementationOnce(() => {
				throw error;
			});

			// Run
			const result = await dataSource.getConfig('/path/to/repo', ['origin']);

			// Assert
			expect(result).toStrictEqual({
				config: null,
				error: 'An unexpected error occurred while spawning the Git child process.'
			});
		});
	});

	describe('getCommitDetails', () => {
		it('Should return the commit details', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (commit doesn\'t have parents)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: [],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-tree', '--name-status', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-tree', '--numstat', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (using git-graph.repository.commits.showSignatureStatus)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbGXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest Signer <test-signer@mhutchie.com> XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb0123456789ABCDEFXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', false);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', true);
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.4.0' });

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.repository.commits.showSignatureStatus'
			});
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: {
						key: '0123456789ABCDEF',
						signer: 'Test Signer <test-signer@mhutchie.com>',
						status: 'G'
					},
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%G?XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%GSXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%GKXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (using git-graph.showSignatureStatus)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbGXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest Signer <test-signer@mhutchie.com> XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb0123456789ABCDEFXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', false);
			vscode.mockExtensionSettingReturnValue('showSignatureStatus', true);
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.4.0' });

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.showSignatureStatus'
			});
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: {
						key: '0123456789ABCDEF',
						signer: 'Test Signer <test-signer@mhutchie.com>',
						status: 'G'
					},
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%G?XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%GSXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%GKXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (without signature status) when Git is older than 2.4.0', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', false);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', true);
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.3.0' });

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (using git-graph.repository.useMailmap)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');
			vscode.mockExtensionSettingReturnValue('repository.useMailmap', true);
			vscode.mockExtensionSettingReturnValue('repository.commits.showSignatureStatus', false);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.repository.useMailmap'
			});
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aNXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aEXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cNXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cEXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (handling unknown Git file status returned by git diff --name-status)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'X', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit details (handling unexpected response format returned by git diff --numstat)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: null,
							deletions: null,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: null,
							deletions: null,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when thrown by git show)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff-tree --name-status)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff-tree --numstat)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getCommitDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});
	});

	describe('getStashDetails', () => {
		it('Should return the stash details', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: null
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the stash details (including untracked files)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3 c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'D', 'dir/other-deleted.txt', 'A', 'dir/added.txt', ''].join('\0'));
			mockGitSuccessOnce(['c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', '0	0	dir/other-deleted.txt', '4	0	dir/added.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
					parents: ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'],
					author: 'Test Author',
					authorEmail: 'test-author@mhutchie.com',
					authorDate: 1587559258,
					committer: 'Test Committer',
					committerEmail: 'test-committer@mhutchie.com',
					committerDate: 1587559259,
					signature: null,
					body: 'Commit Message.\nSecond Line.',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						},
						{
							additions: 4,
							deletions: 0,
							newFilePath: 'dir/added.txt',
							oldFilePath: 'dir/added.txt',
							type: 'U'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'show', '--quiet', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--format=%HXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%PXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%anXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%aeXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%atXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%cnXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ceXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%ctXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%B'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-tree', '--name-status', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-tree', '--numstat', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when thrown by git show)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: null
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff-tree --name-status)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: null
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff-tree --numstat)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: null
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by untracked git diff-tree --name-status)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', '0	0	dir/other-deleted.txt', '4	0	dir/added.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by untracked git diff-tree --numstat)', async () => {
			// Setup
			mockGitSuccessOnce('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPba1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest AuthorXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-author@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest CommitterXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest-committer@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559259XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbCommit Message.\r\nSecond Line.');
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'D', 'dir/other-deleted.txt', 'A', 'dir/added.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getStashDetails('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', {
				selector: 'refs/stash@{0}',
				baseHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
				untrackedFilesHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
			});

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});
	});

	describe('getUncommittedDetails', () => {
		it('Should return the uncommitted changes', async () => {
			// Setup
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', 'M  dir/modified.txt', 'R  dir/renamed-new.txt', 'dir/renamed-old.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: utils.UNCOMMITTED,
					parents: [],
					author: '',
					authorEmail: '',
					authorDate: 0,
					committer: '',
					committerEmail: '',
					committerDate: 0,
					signature: null,
					body: '',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						},
						{
							additions: null,
							deletions: null,
							newFilePath: 'untracked.txt',
							oldFilePath: 'untracked.txt',
							type: 'U'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '-s', '--untracked-files=all', '--porcelain', '-z'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the uncommitted changes (showUntrackedFiles === FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', 'M  dir/modified.txt', 'R  dir/renamed-new.txt', 'dir/renamed-old.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', false);

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: utils.UNCOMMITTED,
					parents: [],
					author: '',
					authorEmail: '',
					authorDate: 0,
					committer: '',
					committerEmail: '',
					committerDate: 0,
					signature: null,
					body: '',
					fileChanges: [
						{
							additions: 0,
							deletions: 0,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						},
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: 2,
							deletions: 3,
							newFilePath: 'dir/renamed-new.txt',
							oldFilePath: 'dir/renamed-old.txt',
							type: 'R'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '-s', '--untracked-files=no', '--porcelain', '-z'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the uncommitted changes (halting invalid git status response)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', ''].join('\0'));
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	1	modified.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', ' D ', 'M  dir/modified.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: {
					hash: utils.UNCOMMITTED,
					parents: [],
					author: '',
					authorEmail: '',
					authorDate: 0,
					committer: '',
					committerEmail: '',
					committerDate: 0,
					signature: null,
					body: '',
					fileChanges: [
						{
							additions: 1,
							deletions: 1,
							newFilePath: 'dir/modified.txt',
							oldFilePath: 'dir/modified.txt',
							type: 'M'
						},
						{
							additions: null,
							deletions: null,
							newFilePath: 'dir/deleted.txt',
							oldFilePath: 'dir/deleted.txt',
							type: 'D'
						}
					]
				},
				error: null
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff --name-status)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', 'M  dir/modified.txt', 'R  dir/renamed-new.txt', 'dir/renamed-old.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff --numstat)', async () => {
			// Setup
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce([' D dir/deleted.txt', 'M  dir/modified.txt', 'R  dir/renamed-new.txt', 'dir/renamed-old.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git status)', async () => {
			// Setup
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getUncommittedDetails('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				commitDetails: null,
				error: 'error message'
			});
		});
	});

	describe('getCommitComparison', () => {
		it('Should return the commit comparison (between a commit and the uncommitted changes)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', 'R051', 'dir/renamed-old.txt', 'dir/renamed-new.txt', 'A', 'added.txt', ''].join('\0'));
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	2	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', '2	0	added.txt', ''].join('\0'));
			mockGitSuccessOnce(['MM dir/modified.txt', 'A  added.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getCommitComparison('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED);

			// Assert
			expect(result).toStrictEqual({
				fileChanges: [
					{
						additions: 1,
						deletions: 1,
						newFilePath: 'dir/modified.txt',
						oldFilePath: 'dir/modified.txt',
						type: 'M'
					},
					{
						additions: 1,
						deletions: 2,
						newFilePath: 'dir/renamed-new.txt',
						oldFilePath: 'dir/renamed-old.txt',
						type: 'R'
					},
					{
						additions: 2,
						deletions: 0,
						newFilePath: 'added.txt',
						oldFilePath: 'added.txt',
						type: 'A'
					},
					{
						additions: null,
						deletions: null,
						newFilePath: 'untracked.txt',
						oldFilePath: 'untracked.txt',
						type: 'U'
					}
				],
				error: null
			});
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['status', '-s', '--untracked-files=all', '--porcelain', '-z'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the commit comparison (between two commits)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', 'R051', 'dir/renamed-old.txt', 'dir/renamed-new.txt', 'A', 'added.txt', ''].join('\0'));
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	2	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', '2	0	added.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getCommitComparison('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

			// Assert
			expect(result).toStrictEqual({
				fileChanges: [
					{
						additions: 1,
						deletions: 1,
						newFilePath: 'dir/modified.txt',
						oldFilePath: 'dir/modified.txt',
						type: 'M'
					},
					{
						additions: 1,
						deletions: 2,
						newFilePath: 'dir/renamed-new.txt',
						oldFilePath: 'dir/renamed-old.txt',
						type: 'R'
					},
					{
						additions: 2,
						deletions: 0,
						newFilePath: 'added.txt',
						oldFilePath: 'added.txt',
						type: 'A'
					}
				],
				error: null
			});
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when thrown by git diff --name-status)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	2	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', '2	0	added.txt', ''].join('\0'));
			mockGitSuccessOnce(['MM dir/modified.txt', 'A  added.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getCommitComparison('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED);

			// Assert
			expect(result).toStrictEqual({
				fileChanges: [],
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git diff --numstat)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', 'R051', 'dir/renamed-old.txt', 'dir/renamed-new.txt', 'A', 'added.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce(['MM dir/modified.txt', 'A  added.txt', '?? untracked.txt'].join('\0'));
			vscode.mockExtensionSettingReturnValue('repository.showUntrackedFiles', true);

			// Run
			const result = await dataSource.getCommitComparison('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED);

			// Assert
			expect(result).toStrictEqual({
				fileChanges: [],
				error: 'error message'
			});
		});

		it('Should return an error message thrown by git (when thrown by git status)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', 'R051', 'dir/renamed-old.txt', 'dir/renamed-new.txt', 'A', 'added.txt', ''].join('\0'));
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	2	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', '2	0	added.txt', ''].join('\0'));
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getCommitComparison('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED);

			expect(result).toStrictEqual({
				fileChanges: [],
				error: 'error message'
			});
		});
	});

	describe('getCommitFile', () => {
		it('Should return the file contents', async () => {
			// Setup
			mockGitSuccessOnce('File contents.\n');
			vscode.mockExtensionSettingReturnValue('fileEncoding', 'cp1252');
			const spyOnDecode = jest.spyOn(iconv, 'decode');

			// Run
			const result = await dataSource.getCommitFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subdirectory/file.txt');

			// Assert
			expect(result.toString()).toBe('File contents.\n');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b:subdirectory/file.txt'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('git-graph', {
				scheme: 'file',
				authority: '',
				path: '/path/to/repo',
				query: '',
				fragment: ''
			});
			expect(spyOnDecode).toBeCalledWith(expect.anything(), 'cp1252');
		});

		it('Should return the file contents (falling back to utf8 if the encoding is unknown)', async () => {
			// Setup
			mockGitSuccessOnce('File contents.\n');
			vscode.mockExtensionSettingReturnValue('fileEncoding', 'xyz');
			const spyOnDecode = jest.spyOn(iconv, 'decode');

			// Run
			const result = await dataSource.getCommitFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subdirectory/file.txt');

			// Assert
			expect(result.toString()).toBe('File contents.\n');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b:subdirectory/file.txt'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('git-graph', {
				scheme: 'file',
				authority: '',
				path: '/path/to/repo',
				query: '',
				fragment: ''
			});
			expect(spyOnDecode).toBeCalledWith(expect.anything(), 'utf8');
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			let errorMessage = null;

			// Run
			await dataSource.getCommitFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subdirectory/file.txt').catch((error) => errorMessage = error);

			// Assert
			expect(errorMessage).toBe('error message');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b:subdirectory/file.txt'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});
	});

	describe('getCommitSubject', () => {
		it('Return the commit subject of a commit', async () => {
			// Setup
			mockGitSuccessOnce('A commit  message.\n');

			// Run
			const result = await dataSource.getCommitSubject('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('A commit message.');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['-c', 'log.showSignature=false', 'log', '--format=%s', '-n', '1', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return NULL when git threw an error', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getCommitSubject('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
		});
	});

	describe('getRemoteUrl', () => {
		it('Should return the url of the remote', async () => {
			// Setup
			mockGitSuccessOnce('https://github.com/mhutchie/vscode-git-graph.git\n');

			// Run
			const result = await dataSource.getRemoteUrl('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe('https://github.com/mhutchie/vscode-git-graph.git');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--get', 'remote.origin.url'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return NULL when git threw an error', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getRemoteUrl('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe(null);
		});
	});

	describe('getNewPathOfRenamedFile', () => {
		it('Should return the new path of a file that was renamed', async () => {
			// Setup
			mockGitSuccessOnce(['R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getNewPathOfRenamedFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'dir/renamed-old.txt');

			// Assert
			expect(result).toBe('dir/renamed-new.txt');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=R', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return NULL when a file wasn\'t renamed', async () => {
			// Setup
			mockGitSuccessOnce(['R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));

			// Run
			const result = await dataSource.getNewPathOfRenamedFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'dir/deleted.txt');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=R', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return NULL when git threw an error', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getNewPathOfRenamedFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'dir/deleted.txt');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff', '--name-status', '--find-renames', '--diff-filter=R', '-z', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});
	});

	describe('getTagDetails', () => {
		it('Should return the tag\'s details', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '1.7.8' });
			mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1\nbody2\n\n');

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: {
					hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
					taggerName: 'Test Tagger',
					taggerEmail: 'test@mhutchie.com',
					taggerDate: 1587559258,
					message: 'subject1\nsubject2\n\nbody1\nbody2',
					signature: null
				},
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the tag\'s details (when email isn\'t enclosed by <>)', async () => {
			// Setup
			mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtag-message\n');

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: {
					hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
					taggerName: 'Test Tagger',
					taggerEmail: 'test@mhutchie.com',
					taggerDate: 1587559258,
					message: 'tag-message',
					signature: null
				},
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the tag\'s details (contents contains separator)', async () => {
			// Setup
			mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1 XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%\nbody2\n\n');

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: {
					hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
					taggerName: 'Test Tagger',
					taggerEmail: 'test@mhutchie.com',
					taggerDate: 1587559258,
					message: 'subject1\nsubject2\n\nbody1 XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%\nbody2',
					signature: null
				},
				error: null
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the "Incompatible Git Version" error message when viewing tag details and Git is older than 1.7.8', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '1.7.7' });

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: null,
				error: 'A newer version of Git (>= 1.7.8) is required for retrieving Tag Details. Git 1.7.7 is currently installed. Please install a newer version of Git to use this feature.'
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(0);
		});

		it('Should return the "Unable to Find Git" error message when no Git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: null,
				error: 'Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.'
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(0);
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				details: null,
				error: 'error message'
			});
			expect(spyOnSpawn).toHaveBeenCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		describe('getTagSignature', () => {
			const testParsingGpgStatus = (signatureRecord: string, trustLevel: string, expected: GitSignature) => async () => {
				// Setup
				mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\nXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1\nbody2\n-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\n\n');
				mockGitSuccessOnce('', '[GNUPG:] NEWSIG\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] SIG_ID abcdefghijklmnopqrstuvwxyza 2021-04-10 1618040201\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n' + signatureRecord + '[GNUPG:] VALIDSIG ABCDEF1234567890ABCDEF1234567890ABCDEF12 2021-04-10 1618040201 0 4 0 1 8 00 ABCDEF1234567890ABCDEF1234567890ABCDEF12\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] ' + trustLevel + ' 0 pgp\r\n[GNUPG:] VERIFICATION_COMPLIANCE_MODE 23\r\n');

				// Run
				const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

				// Assert
				expect(result).toStrictEqual({
					details: {
						hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
						taggerName: 'Test Tagger',
						taggerEmail: 'test@mhutchie.com',
						taggerDate: 1587559258,
						message: 'subject1\nsubject2\n\nbody1\nbody2',
						signature: expected
					},
					error: null
				});
				expect(spyOnSpawn).toHaveBeenCalledTimes(2);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['verify-tag', '--raw', 'refs/tags/tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			};

			it('Should parse and return a GOODSIG', testParsingGpgStatus('[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodAndValid
			}));

			it('Should parse and return a BADSIG', testParsingGpgStatus('[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.Bad
			}));

			it('Should parse and return an ERRSIG', testParsingGpgStatus('[GNUPG:] ERRSIG 1234567890ABCDEF 0 1 2 3 4\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: '',
				status: GitSignatureStatus.CannotBeChecked
			}));

			it('Should parse and return an EXPSIG', testParsingGpgStatus('[GNUPG:] EXPSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodButExpired
			}));

			it('Should parse and return an EXPKEYSIG', testParsingGpgStatus('[GNUPG:] EXPKEYSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodButMadeByExpiredKey
			}));

			it('Should parse and return a REVKEYSIG', testParsingGpgStatus('[GNUPG:] REVKEYSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_ULTIMATE', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodButMadeByRevokedKey
			}));

			it('Should parse TRUST_UNDEFINED, and apply it to a GOODSIG', testParsingGpgStatus('[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_UNDEFINED', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodWithUnknownValidity
			}));

			it('Should parse TRUST_NEVER, and apply it to a GOODSIG', testParsingGpgStatus('[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_NEVER', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.GoodWithUnknownValidity
			}));

			it('Should parse TRUST_UNDEFINED, and NOT apply it to a BADSIG', testParsingGpgStatus('[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n', 'TRUST_UNDEFINED', {
				key: '1234567890ABCDEF',
				signer: 'Tagger Name <tagger@mhutchie.com>',
				status: GitSignatureStatus.Bad
			}));

			it('Should return a signature with status GitSignatureStatus.CannotBeChecked when no signature can be parsed', testParsingGpgStatus('', 'TRUST_ULTIMATE', {
				key: '',
				signer: '',
				status: GitSignatureStatus.CannotBeChecked
			}));

			it('Should return a signature with status GitSignatureStatus.CannotBeChecked when multiple exclusive statuses exist', testParsingGpgStatus(
				'[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n',
				'TRUST_ULTIMATE',
				{
					key: '',
					signer: '',
					status: GitSignatureStatus.CannotBeChecked
				}
			));

			it('Should ignore records that don\'t start with "[GNUPG:]"', testParsingGpgStatus(
				'[XYZ] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\n',
				'TRUST_ULTIMATE',
				{
					key: '1234567890ABCDEF',
					signer: 'Tagger Name <tagger@mhutchie.com>',
					status: GitSignatureStatus.Bad
				}
			));

			it('Should parse signatures from stdout when there is not content on stderr (for compatibility - normally output is on stderr)', async () => {
				// Setup
				mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\nXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1\nbody2\n-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\n\n');
				mockGitSuccessOnce('[GNUPG:] NEWSIG\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] SIG_ID abcdefghijklmnopqrstuvwxyza 2021-04-10 1618040201\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\r\n[GNUPG:] VALIDSIG ABCDEF1234567890ABCDEF1234567890ABCDEF12 2021-04-10 1618040201 0 4 0 1 8 00 ABCDEF1234567890ABCDEF1234567890ABCDEF12\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] TRUST_ULTIMATE 0 pgp\r\n[GNUPG:] VERIFICATION_COMPLIANCE_MODE 23\r\n');

				// Run
				const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

				// Assert
				expect(result).toStrictEqual({
					details: {
						hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
						taggerName: 'Test Tagger',
						taggerEmail: 'test@mhutchie.com',
						taggerDate: 1587559258,
						message: 'subject1\nsubject2\n\nbody1\nbody2',
						signature: {
							key: '1234567890ABCDEF',
							signer: 'Tagger Name <tagger@mhutchie.com>',
							status: GitSignatureStatus.GoodAndValid
						}
					},
					error: null
				});
				expect(spyOnSpawn).toHaveBeenCalledTimes(2);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['verify-tag', '--raw', 'refs/tags/tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Should parse signatures from stderr, when both stdout & stderr have content (for compatibility - normally output is on stderr)', async () => {
				// Setup
				mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\nXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1\nbody2\n-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\n\n');
				mockGitSuccessOnce(
					'[GNUPG:] NEWSIG\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] SIG_ID abcdefghijklmnopqrstuvwxyza 2021-04-10 1618040201\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] GOODSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\r\n[GNUPG:] VALIDSIG ABCDEF1234567890ABCDEF1234567890ABCDEF12 2021-04-10 1618040201 0 4 0 1 8 00 ABCDEF1234567890ABCDEF1234567890ABCDEF12\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] TRUST_ULTIMATE 0 pgp\r\n[GNUPG:] VERIFICATION_COMPLIANCE_MODE 23\r\n',
					'[GNUPG:] NEWSIG\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] SIG_ID abcdefghijklmnopqrstuvwxyza 2021-04-10 1618040201\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>\r\n[GNUPG:] VALIDSIG ABCDEF1234567890ABCDEF1234567890ABCDEF12 2021-04-10 1618040201 0 4 0 1 8 00 ABCDEF1234567890ABCDEF1234567890ABCDEF12\r\n[GNUPG:] KEY_CONSIDERED ABCDEF1234567890ABCDEF1234567890ABCDEF12 0\r\n[GNUPG:] TRUST_ULTIMATE 0 pgp\r\n[GNUPG:] VERIFICATION_COMPLIANCE_MODE 23\r\n'
				);

				// Run
				const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

				// Assert
				expect(result).toStrictEqual({
					details: {
						hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
						taggerName: 'Test Tagger',
						taggerEmail: 'test@mhutchie.com',
						taggerDate: 1587559258,
						message: 'subject1\nsubject2\n\nbody1\nbody2',
						signature: {
							key: '1234567890ABCDEF',
							signer: 'Tagger Name <tagger@mhutchie.com>',
							status: GitSignatureStatus.Bad
						}
					},
					error: null
				});
				expect(spyOnSpawn).toHaveBeenCalledTimes(2);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['verify-tag', '--raw', 'refs/tags/tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Should ignore the Git exit code when parsing signatures', async () => {
				// Setup
				mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbTest TaggerXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<test@mhutchie.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\nXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbsubject1\r\nsubject2\n\nbody1\nbody2\n-----BEGIN PGP SIGNATURE-----\n\n-----END PGP SIGNATURE-----\n\n');
				mockGitThrowingErrorOnce('[GNUPG:] BADSIG 1234567890ABCDEF Tagger Name <tagger@mhutchie.com>');

				// Run
				const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

				// Assert
				expect(result).toStrictEqual({
					details: {
						hash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
						taggerName: 'Test Tagger',
						taggerEmail: 'test@mhutchie.com',
						taggerDate: 1587559258,
						message: 'subject1\nsubject2\n\nbody1\nbody2',
						signature: {
							key: '1234567890ABCDEF',
							signer: 'Tagger Name <tagger@mhutchie.com>',
							status: GitSignatureStatus.Bad
						}
					},
					error: null
				});
				expect(spyOnSpawn).toHaveBeenCalledTimes(2);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents:signature)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['verify-tag', '--raw', 'refs/tags/tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});
		});
	});

	describe('getSubmodules', () => {
		let platform: NodeJS.Platform;
		beforeEach(() => {
			platform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'not-windows' });
		});
		afterEach(() => {
			Object.defineProperty(process, 'platform', { value: platform });
		});

		it('Should return no submodules if no .gitmodules file exists', async () => {
			// Setup
			const spyOnReadFile = jest.spyOn(fs, 'readFile');
			spyOnReadFile.mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, any, (err: NodeJS.ErrnoException | null, data: Buffer) => void])[2](new Error(), Buffer.alloc(0)));

			// Run
			const result = await dataSource.getSubmodules('/path/to/repo');

			// Assert
			expect(result).toStrictEqual([]);
			const [path, options] = spyOnReadFile.mock.calls[0];
			expect(utils.getPathFromStr(path as string)).toBe('/path/to/repo/.gitmodules');
			expect(options).toStrictEqual({ encoding: 'utf8' });
		});

		it('Should return the submodules when a .gitmodules file exists', async () => {
			// Setup
			const spyOnReadFile = jest.spyOn(fs, 'readFile');
			spyOnReadFile.mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, any, (err: NodeJS.ErrnoException | null, data: string) => void])[2](null,
				'[submodule "folder/vscode-git-graph-1"]\n' +
				'	path = folder/vscode-git-graph-1\n' +
				'	url = https://github.com/mhutchie/vscode-git-graph\n' +
				'[submodule "folder/vscode-git-graph-2"]\n' +
				'	path = folder/vscode-git-graph-2\n' +
				'	url = https://github.com/mhutchie/vscode-git-graph\n' +
				'[submodule "folder/vscode-git-graph-3"]\n' +
				'	path = folder/vscode-git-graph-3\n' +
				'	url = https://github.com/mhutchie/vscode-git-graph\n'
			));
			mockGitSuccessOnce('/path/to/repo/folder/vscode-git-graph-1');
			mockGitSuccessOnce('/path/to/repo/folder/vscode-git-graph-2');
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getSubmodules('/path/to/repo');

			// Assert
			expect(result).toStrictEqual(['/path/to/repo/folder/vscode-git-graph-1', '/path/to/repo/folder/vscode-git-graph-2']);
			const [path, options] = spyOnReadFile.mock.calls[0];
			expect(utils.getPathFromStr(path as string)).toBe('/path/to/repo/.gitmodules');
			expect(options).toStrictEqual({ encoding: 'utf8' });
		});
	});

	describe('repoRoot', () => {
		let platform: NodeJS.Platform;
		beforeEach(() => {
			platform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'not-windows' });
		});
		afterEach(() => {
			Object.defineProperty(process, 'platform', { value: platform });
		});

		it('Should return the same directory when called from the root of the repository', async () => {
			// Setup
			mockGitSuccessOnce('/path/to/repo/root');

			// Run
			const result = await dataSource.repoRoot('/path/to/repo/root');

			// Assert
			expect(result).toBe('/path/to/repo/root');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/path/to/repo/root' }));
		});

		it('Should return the same directory when called from the a path resolving to the root of the repository', async () => {
			// Setup
			mockGitSuccessOnce('/path/to/repo/root');
			jest.spyOn(utils, 'realpath').mockResolvedValueOnce('/path/to/repo/root');

			// Run
			const result = await dataSource.repoRoot('/path/to/symbolic-repo/root');

			// Assert
			expect(result).toBe('/path/to/symbolic-repo/root');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/path/to/symbolic-repo/root' }));
		});

		it('Should return the root directory when called from a subdirectory of the repository', async () => {
			// Setup
			mockGitSuccessOnce('/path/to/repo/root');

			// Run
			const result = await dataSource.repoRoot('/path/to/repo/root/subdirectory');

			// Assert
			expect(result).toBe('/path/to/repo/root');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/path/to/repo/root/subdirectory' }));
		});

		it('Should return the symbolic directory when called from a subdirectory of the repository', async () => {
			// Setup
			mockGitSuccessOnce('/path/to/repo/root');
			jest.spyOn(utils, 'realpath').mockResolvedValueOnce('/path/to/repo/root/subdirectory').mockResolvedValueOnce('/path/to/repo/root');

			// Run
			const result = await dataSource.repoRoot('/path/to/symbolic-repo/root/subdirectory');

			// Assert
			expect(result).toBe('/path/to/symbolic-repo/root');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/path/to/symbolic-repo/root/subdirectory' }));
		});

		it('Should return the canonical root directory when failed to find match', async () => {
			// Setup
			mockGitSuccessOnce('/other-path');
			jest.spyOn(utils, 'realpath').mockResolvedValueOnce('/another-path');

			// Run
			const result = await dataSource.repoRoot('/path');

			// Assert
			expect(result).toBe('/other-path');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/path' }));
		});

		describe('Windows Mapped Network Drive Resolution', () => {
			it('Should not alter non-network share drives', async () => {
				// Setup
				mockGitSuccessOnce('c:/path/to/repo/root');
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const spyOnRealpath = jest.spyOn(utils, 'realpath');

				// Run
				const result = await dataSource.repoRoot('c:/path/to/repo/root');

				// Assert
				expect(result).toBe('c:/path/to/repo/root');
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: 'c:/path/to/repo/root' }));
				expect(spyOnRealpath).toHaveBeenCalledTimes(0);
			});

			it('Should resolve the UNC Path Prefix of a path on a network share', async () => {
				// Setup
				mockGitSuccessOnce('//network/drive/path/to/repo/root');
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const spyOnRealpath = jest.spyOn(utils, 'realpath');
				spyOnRealpath.mockResolvedValueOnce('//network/drive/');

				// Run
				const result = await dataSource.repoRoot('a:/path/to/repo/root');

				// Assert
				expect(result).toBe('a:/path/to/repo/root');
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: 'a:/path/to/repo/root' }));
				expect(spyOnRealpath).toBeCalledWith('a:/', true);
			});

			it('Should resolve the UNC Path Prefix of a path on a network share (when native realpath doesn\'t return a trailing slash)', async () => {
				// Setup
				mockGitSuccessOnce('//network/drive/path/to/repo/root');
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const spyOnRealpath = jest.spyOn(utils, 'realpath');
				spyOnRealpath.mockResolvedValueOnce('//network/drive');

				// Run
				const result = await dataSource.repoRoot('a:/path/to/repo/root');

				// Assert
				expect(result).toBe('a:/path/to/repo/root');
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: 'a:/path/to/repo/root' }));
				expect(spyOnRealpath).toBeCalledWith('a:/', true);
			});

			it('Should not adjust the path if the native realpath can\'t resolve the Mapped Network Drive Letter', async () => {
				// Setup
				mockGitSuccessOnce('//network/drive/path/to/repo/root');
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const spyOnRealpath = jest.spyOn(utils, 'realpath');
				spyOnRealpath.mockResolvedValueOnce('a:/');

				// Run
				const result = await dataSource.repoRoot('a:/path/to/repo/root');

				// Assert
				expect(result).toBe('//network/drive/path/to/repo/root');
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: 'a:/path/to/repo/root' }));
				expect(spyOnRealpath).toBeCalledWith('a:/', true);
			});

			it('Should not adjust the path if the native realpath resolves the Mapped Network Drive Letter to a different UNC Path Prefix', async () => {
				// Setup
				mockGitSuccessOnce('//network/drive/path/to/repo/root');
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const spyOnRealpath = jest.spyOn(utils, 'realpath');
				spyOnRealpath.mockResolvedValueOnce('//other/network/drive/');

				// Run
				const result = await dataSource.repoRoot('a:/path/to/repo/root');

				// Assert
				expect(result).toBe('//network/drive/path/to/repo/root');
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: 'a:/path/to/repo/root' }));
				expect(spyOnRealpath).toBeCalledWith('a:/', true);
			});
		});

		it('Should return NULL when git threw an error', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.repoRoot('/path/to/repo/root');

			// Assert
			expect(result).toBe(null);
		});
	});

	describe('addRemote', () => {
		it('Should add a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.addRemote('/path/to/repo', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', null, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'add', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add a remote (with a push url)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.addRemote('/path/to/repo', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', 'https://github.com/mhutchie/vscode-git-graph.git', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'add', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', 'origin', '--push', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add and fetch a remote', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.addRemote('/path/to/repo', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', null, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'add', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when adding the remote)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.addRemote('/path/to/repo', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', null, false);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message thrown by git (when adding the push url)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.addRemote('/path/to/repo', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', 'https://github.com/mhutchie/vscode-git-graph.git', true);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(2);
		});
	});

	describe('deleteRemote', () => {
		it('Should delete a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteRemote('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'remove', 'origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteRemote('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('editRemote', () => {
		it('Should rename a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'old-origin', 'new-origin', '', '', null, null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'rename', 'old-origin', 'new-origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should delete the url of a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', 'https://github.com/mhutchie/vscode-git-graph.git', null, null, null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', 'origin', '--delete', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add a url to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, 'https://github.com/mhutchie/vscode-git-graph.git', null, null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', 'origin', '--add', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should update the url of a the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', 'https://github.com/mhutchie/vscode-git-graph-old.git', 'https://github.com/mhutchie/vscode-git-graph-new.git', null, null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', 'origin', 'https://github.com/mhutchie/vscode-git-graph-new.git', 'https://github.com/mhutchie/vscode-git-graph-old.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should delete the push url of a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, null, 'https://github.com/mhutchie/vscode-git-graph.git', null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', '--push', 'origin', '--delete', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add a push url to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, null, null, 'https://github.com/mhutchie/vscode-git-graph.git');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', '--push', 'origin', '--add', 'https://github.com/mhutchie/vscode-git-graph.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should update the push url of a the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, null, 'https://github.com/mhutchie/vscode-git-graph-old.git', 'https://github.com/mhutchie/vscode-git-graph-new.git');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'set-url', '--push', 'origin', 'https://github.com/mhutchie/vscode-git-graph-new.git', 'https://github.com/mhutchie/vscode-git-graph-old.git'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when renaming a remote)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'old-origin', 'new-origin', '', '', null, null);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message thrown by git (when adding a url)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, 'https://github.com/mhutchie/vscode-git-graph.git', null, null);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message thrown by git (when adding a push url)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.editRemote('/path/to/repo', 'origin', 'origin', null, null, null, 'https://github.com/mhutchie/vscode-git-graph.git');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('pruneRemote', () => {
		it('Should prune a remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pruneRemote('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote', 'prune', 'origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pruneRemote('/path/to/repo', 'origin');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('addTag', () => {
		it('Should add a lightweight tag to a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', TagType.Lightweight, '', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add an annotated tag to a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.tags', false);

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', TagType.Annotated, 'message', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-a', 'tag-name', '-m', 'message', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add a signed tag to a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.tags', true);

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', TagType.Annotated, 'message', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-s', 'tag-name', '-m', 'message', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force add a tag to a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.tags', false);

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', TagType.Annotated, 'message', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-f', '-a', 'tag-name', '-m', 'message', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.tags', false);

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', TagType.Lightweight, '', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('deleteTag', () => {
		it('Should delete a tag', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteTag('/path/to/repo', 'tag-name', null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-d', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should delete a tag (also on a remote)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteTag('/path/to/repo', 'tag-name', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', '--delete', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-d', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when deleting a tag)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteTag('/path/to/repo', 'tag-name', null);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message thrown by git (when deleting a tag also on a remote)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteTag('/path/to/repo', 'tag-name', 'origin');

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(1);
		});
	});

	describe('fetch', () => {
		it('Should fetch all remotes', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '--all'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should fetch a specific remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', 'origin', false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should fetch and prune all remotes', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '--all', '--prune'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should fetch and prune all remotes (and prune tags)', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.17.0' });
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '--all', '--prune', '--prune-tags'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, false, false);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message when pruning tags, but pruning is not enabled (all remotes)', async () => {
			// Setup

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, false, true);

			// Assert
			expect(result).toBe('In order to Prune Tags, pruning must also be enabled when fetching from remote(s).');
		});

		it('Should return an error message when pruning tags, but pruning is not enabled (specific remote)', async () => {
			// Setup

			// Run
			const result = await dataSource.fetch('/path/to/repo', 'origin', false, true);

			// Assert
			expect(result).toBe('In order to Prune Tags, pruning must also be enabled when fetching from a remote.');
		});

		it('Should return an error message when pruning tags when no Git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, true, true);

			// Assert
			expect(result).toBe('Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.');
		});

		it('Should return the "Incompatible Git Version" error message when pruning tags and Git is older than 2.17.0', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.16.1' });

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, true, true);

			// Assert
			expect(result).toBe('A newer version of Git (>= 2.17.0) is required for pruning tags when fetching. Git 2.16.1 is currently installed. Please install a newer version of Git to use this feature.');
		});
	});

	describe('pushBranch', () => {
		it('Should push a branch to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranch('/path/to/repo', 'master', 'origin', false, GitPushBranchMode.Normal);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push a branch to the remote and set upstream', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranch('/path/to/repo', 'master', 'origin', true, GitPushBranchMode.Normal);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master', '--set-upstream'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force push a branch to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranch('/path/to/repo', 'master', 'origin', false, GitPushBranchMode.Force);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master', '--force'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force (with lease) push a branch to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranch('/path/to/repo', 'master', 'origin', false, GitPushBranchMode.ForceWithLease);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master', '--force-with-lease'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pushBranch('/path/to/repo', 'master', 'origin', false, GitPushBranchMode.Normal);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('pushBranchToMultipleRemotes', () => {
		it('Should push a branch to one remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranchToMultipleRemotes('/path/to/repo', 'master', ['origin'], false, GitPushBranchMode.Normal);

			// Assert
			expect(result).toStrictEqual([null]);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push a branch to multiple remotes', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushBranchToMultipleRemotes('/path/to/repo', 'master', ['origin', 'other-origin'], false, GitPushBranchMode.Force);

			// Assert
			expect(result).toStrictEqual([null, null]);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master', '--force'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'master', '--force'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push a branch to multiple remotes, stopping if an error occurs', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pushBranchToMultipleRemotes('/path/to/repo', 'master', ['origin', 'other-origin', 'another-origin'], true, GitPushBranchMode.Normal);

			// Assert
			expect(result).toStrictEqual([null, 'error message']);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'master', '--set-upstream'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'master', '--set-upstream'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error when no remotes are specified', async () => {
			// Run
			const result = await dataSource.pushBranchToMultipleRemotes('/path/to/repo', 'master', [], false, GitPushBranchMode.Normal);

			// Assert
			expect(result).toStrictEqual(['No remote(s) were specified to push the branch master to.']);
		});
	});

	describe('pushTag', () => {
		it('Should push a tag to one remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual([null]);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push a tag to multiple remotes', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual([null, null]);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		describe('Should check that the commit exists on each remote the tag is being pushed to', () => {
			it('Commit exists on all remotes', async () => {
				// Setup
				mockGitSuccessOnce(
					'  origin/master\n' +
					'  other-origin/master\n'
				);
				mockGitSuccessOnce();
				mockGitSuccessOnce();

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual([null, null]);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Commit exists on one remote', async () => {
				// Setup
				mockGitSuccessOnce(
					'  origin/master\n'
				);

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual(['VSCODE_GIT_GRAPH:PUSH_TAG:COMMIT_NOT_ON_REMOTE:[\"other-origin\"]']);
				expect(spyOnSpawn).toHaveBeenCalledTimes(1);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Commit doesn\'t exist on any remote', async () => {
				// Setup
				mockGitSuccessOnce('');

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual(['VSCODE_GIT_GRAPH:PUSH_TAG:COMMIT_NOT_ON_REMOTE:[\"origin\",\"other-origin\"]']);
				expect(spyOnSpawn).toHaveBeenCalledTimes(1);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Handles remote branches with symbolic references', async () => {
				// Setup
				mockGitSuccessOnce(
					'  origin/HEAD -> origin/master\n' +
					'  other-origin/master\n'
				);
				mockGitSuccessOnce();
				mockGitSuccessOnce();

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual([null, null]);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Handles remote names that contain slashes', async () => {
				// Setup
				mockGitSuccessOnce(
					'  origin/master\n' +
					'  other/origin/master\n'
				);
				mockGitSuccessOnce();
				mockGitSuccessOnce();

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other/origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual([null, null]);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other/origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Ignores records that aren\'t branches in the git branch output', async () => {
				// Setup
				mockGitSuccessOnce(
					'  (invalid branch)\n' +
					'  other-origin/master\n'
				);

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual(['VSCODE_GIT_GRAPH:PUSH_TAG:COMMIT_NOT_ON_REMOTE:[\"origin\"]']);
				expect(spyOnSpawn).toHaveBeenCalledTimes(1);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});

			it('Ignores when Git throws an exception', async () => {
				// Setup
				mockGitThrowingErrorOnce();
				mockGitSuccessOnce();
				mockGitSuccessOnce();

				// Run
				const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

				// Assert
				expect(result).toStrictEqual([null, null]);
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-r', '--no-color', '--contains=1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
				expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			});
		});

		it('Should push a tag to multiple remotes, stopping if an error occurs', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', ['origin', 'other-origin', 'another-origin'], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual([null, 'error message']);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'other-origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error when no remotes are specified', async () => {
			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', [], '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toStrictEqual(['No remote(s) were specified to push the tag tag-name to.']);
		});
	});

	describe('checkoutBranch', () => {
		it('Should checkout a local branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.checkoutBranch('/path/to/repo', 'master', null);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should checkout a remote branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.checkoutBranch('/path/to/repo', 'master', 'origin/master');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', '-b', 'master', 'origin/master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.checkoutBranch('/path/to/repo', 'master', null);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('createBranch', () => {
		it('Should create a branch at a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false, false);

			// Assert
			expect(result).toStrictEqual([null]);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should create a branch at a commit, and check it out', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, false);

			// Assert
			expect(result).toStrictEqual([null]);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', '-b', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force create a branch at a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false, true);

			// Assert
			expect(result).toStrictEqual([null]);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-f', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force create a branch at a commit, and check it out', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, true);

			// Assert
			expect(result).toStrictEqual([null, null]);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-f', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false, false);

			// Assert
			expect(result).toStrictEqual(['error message']);
		});

		it('Should return an error message thrown by git when creating a branch, and not proceed to check out the force-created branch', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, true);

			// Assert
			expect(result).toStrictEqual(['error message']);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-f', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git when checking out a force-created branch', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, true);

			// Assert
			expect(result).toStrictEqual([null, 'error message']);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-f', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});
	});

	describe('deleteBranch', () => {
		it('Should delete the branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteBranch('/path/to/repo', 'master', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-d', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force delete the branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteBranch('/path/to/repo', 'master', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-D', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteBranch('/path/to/repo', 'master', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('deleteRemoteBranch', () => {
		it('Should delete the remote branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteRemoteBranch('/path/to/repo', 'develop', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', '--delete', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should delete the remote tracking branch if the branch is no longer on the remote', async () => {
			// Setup
			mockGitThrowingErrorOnce('remote ref does not exist');
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteRemoteBranch('/path/to/repo', 'develop', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', '--delete', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-d', '-r', 'origin/develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (while deleting the branch on the remote)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteRemoteBranch('/path/to/repo', 'develop', 'origin');

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return an error message thrown by git (while deleting the remote tracking branch)', async () => {
			// Setup
			mockGitThrowingErrorOnce('remote ref does not exist');
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.deleteRemoteBranch('/path/to/repo', 'develop', 'origin');

			// Assert
			expect(result).toBe('Branch does not exist on the remote, deleting the remote tracking branch origin/develop.\nerror message');
		});
	});

	describe('fetchIntoLocalBranch', () => {
		it('Should fetch a remote branch into a local branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetchIntoLocalBranch('/path/to/repo', 'origin', 'master', 'develop', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin', 'master:develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should (force) fetch a remote branch into a local branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetchIntoLocalBranch('/path/to/repo', 'origin', 'master', 'develop', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '-f', 'origin', 'master:develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.fetchIntoLocalBranch('/path/to/repo', 'origin', 'master', 'develop', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('pullBranch', () => {
		it('Should pull a remote branch into the current branch', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (always creating a new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--no-ff'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (signing the new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--no-ff', '-S'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(workspaceConfiguration.get).toBeCalledTimes(3);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', expect.anything());
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'origin/master\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and staged changes exist, signing merge commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(workspaceConfiguration.get).toBeCalledTimes(3);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', expect.anything());
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash', '-S'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-S', '-m', 'Merge branch \'origin/master\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and no staged changes)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and when diff-index fails)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (ignore create new commit when squashing)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'origin/master\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and staged changes exist, dialog.pullBranch.squashMessageFormat === "Git SQUASH_MSG")', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Git SQUASH_MSG');

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '--no-edit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when pull fails)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(1);
		});

		it('Should return an error message thrown by git (when commit fails)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(3);
		});
	});

	describe('renameBranch', () => {
		it('Should rename a branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.renameBranch('/path/to/repo', 'old-master', 'new-master');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '-m', 'old-master', 'new-master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.renameBranch('/path/to/repo', 'old-master', 'new-master');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('merge', () => {
		it('Should merge a branch into the current branch', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (always creating a new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, true, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--no-ff'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (signing the new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, true, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--no-ff', '-S'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(workspaceConfiguration.get).toBeCalledTimes(3);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', expect.anything());
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'develop\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a remote-tracking branch into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.merge('/path/to/repo', 'origin/develop', MergeActionOn.RemoteTrackingBranch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'origin/develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge remote-tracking branch \'origin/develop\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a commit into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.merge('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', MergeActionOn.Commit, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge commit \'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and staged changes exist, signing merge commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Default');

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(workspaceConfiguration.get).toBeCalledTimes(3);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', expect.anything());
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash', '-S'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-S', '-m', 'Merge branch \'develop\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and staged changes exist, dialog.merge.squashMessageFormat === "Git SQUASH_MSG")', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Git SQUASH_MSG');

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '--no-edit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and no staged changes)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (without committing)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash without committing)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (ignore create new commit when squashing)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, true, true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when merge fails)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(1);
		});

		it('Should return an error message thrown by git (when commit fails)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', MergeActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'develop\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});
	});

	describe('rebase', () => {
		it('Should rebase the current branch on a branch', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should rebase the current branch on a branch (ignoring date)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', 'develop', '--ignore-date'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should rebase the current branch on a branch (signing the new commits)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', 'develop', '-S'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, false, false);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should launch the interactive rebase of the current branch on a branch in a terminal', async () => {
			// Setup
			jest.useFakeTimers();
			const spyOnOpenGitTerminal = jest.spyOn(utils, 'openGitTerminal');
			spyOnOpenGitTerminal.mockReturnValueOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const resultPromise = dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, false, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1000);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnOpenGitTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'rebase --interactive develop', 'Rebase on "develop"');
		});

		it('Should launch the interactive rebase of the current branch on a commit in a terminal', async () => {
			// Setup
			jest.useFakeTimers();
			const spyOnOpenGitTerminal = jest.spyOn(utils, 'openGitTerminal');
			spyOnOpenGitTerminal.mockReturnValueOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const resultPromise = dataSource.rebase('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', RebaseActionOn.Commit, false, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1000);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnOpenGitTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'rebase --interactive 1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'Rebase on "1a2b3c4d"');
		});

		it('Should launch the interactive rebase of the current branch on a branch in a terminal (signing the new commits)', async () => {
			// Setup
			jest.useFakeTimers();
			const spyOnOpenGitTerminal = jest.spyOn(utils, 'openGitTerminal');
			spyOnOpenGitTerminal.mockReturnValueOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const resultPromise = dataSource.rebase('/path/to/repo', 'develop', RebaseActionOn.Branch, false, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1000);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnOpenGitTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'rebase --interactive -S develop', 'Rebase on "develop"');
		});

		it('Should return the "Unable to Find Git" error message when no git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.rebase('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', RebaseActionOn.Commit, false, true);

			// Assert
			expect(result).toBe('Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.');
		});
	});

	describe('archive', () => {
		it('Should create a *.tar archive of a ref', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.archive('/path/to/repo', 'master', '/path/to/output/file.tar', 'tar');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['archive', '--format=tar', '-o', '/path/to/output/file.tar', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should create a *.zip archive of a ref', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.archive('/path/to/repo', 'master', '/path/to/output/file.zip', 'zip');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['archive', '--format=zip', '-o', '/path/to/output/file.zip', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.archive('/path/to/repo', 'master', '/path/to/output/file.tar', 'tar');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('checkoutCommit', () => {
		it('Should checkout a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.checkoutCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.checkoutCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('cherrypickCommit', () => {
		it('Should cherrypick a commit (with a single parent)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should cherrypick a commit (with multiple parents)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 2, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '-m', '2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should record origin when cherry picking a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '-x', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should cherrypick a commit (signing the new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '-S', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should not commit the cherrypick of a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '--no-commit', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('dropCommit', () => {
		it('Should drop a commit', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.dropCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', '--onto', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should drop a commit (signing any new commits)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.dropCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', '-S', '--onto', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.dropCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('resetToCommit', () => {
		it('Should perform a hard reset to a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.resetToCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitResetMode.Hard);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reset', '--hard', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should perform a hard reset to a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.resetToCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitResetMode.Mixed);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reset', '--mixed', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should perform a hard reset to a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.resetToCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitResetMode.Soft);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['reset', '--soft', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.resetToCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitResetMode.Hard);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('revertCommit', () => {
		it('Should revert a commit (with a single parent)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['revert', '--no-edit', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should revert a commit (with multiple parents)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 2);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['revert', '--no-edit', '-m', '2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should revert a commit (signing the new commit)', async () => {
			// Setup
			mockGitSuccessOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', true);

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['revert', '--no-edit', '-S', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			vscode.mockExtensionSettingReturnValue('repository.sign.commits', false);

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 2);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('setConfigValue', () => {
		it('Should set a global config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', GitConfigKey.UserName, 'Test User Name', GitConfigLocation.Global);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--global', 'user.name', 'Test User Name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should set a local config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', GitConfigKey.UserName, 'Test User Name', GitConfigLocation.Local);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--local', 'user.name', 'Test User Name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should set a system config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', GitConfigKey.UserName, 'Test User Name', GitConfigLocation.System);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--system', 'user.name', 'Test User Name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', GitConfigKey.UserName, 'Test User Name', GitConfigLocation.Global);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('unsetConfigValue', () => {
		it('Should unset a global config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', GitConfigKey.UserName, GitConfigLocation.Global);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--global', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should unset a local config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', GitConfigKey.UserName, GitConfigLocation.Local);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--local', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should unset a system config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', GitConfigKey.UserName, GitConfigLocation.System);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--system', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', GitConfigKey.UserName, GitConfigLocation.Global);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('cleanUntrackedFiles', () => {
		it('Should clean untracked files', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.cleanUntrackedFiles('/path/to/repo', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['clean', '-f'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should clean untracked files and directories', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.cleanUntrackedFiles('/path/to/repo', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['clean', '-fd'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.cleanUntrackedFiles('/path/to/repo', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('resetFileToRevision', () => {
		it('Should reset file to revision', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.resetFileToRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'path/to/file');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--', 'path/to/file'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.resetFileToRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'path/to/file');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('applyStash', () => {
		it('Should apply a stash', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.applyStash('/path/to/repo', 'refs/stash@{0}', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'apply', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should apply a stash and reinstate the index', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.applyStash('/path/to/repo', 'refs/stash@{0}', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'apply', '--index', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.applyStash('/path/to/repo', 'refs/stash@{0}', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('branchFromStash', () => {
		it('Should create a branch from a stash', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.branchFromStash('/path/to/repo', 'refs/stash@{0}', 'stash-branch');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'branch', 'stash-branch', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.branchFromStash('/path/to/repo', 'refs/stash@{0}', 'stash-branch');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('dropStash', () => {
		it('Should drop a stash', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.dropStash('/path/to/repo', 'refs/stash@{0}');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'drop', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.dropStash('/path/to/repo', 'refs/stash@{0}');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('popStash', () => {
		it('Should pop a stash', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.popStash('/path/to/repo', 'refs/stash@{0}', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'pop', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pop a stash and reinstate the index', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.popStash('/path/to/repo', 'refs/stash@{0}', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'pop', '--index', 'refs/stash@{0}'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.popStash('/path/to/repo', 'refs/stash@{0}', false);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('pushStash', () => {
		it('Should push the uncommitted changes to a stash', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.13.2' });
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'push'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push the uncommitted changes to a stash, and set the message', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushStash('/path/to/repo', 'Stash Message', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'push', '--message', 'Stash Message'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should push the uncommitted changes (and untracked files) to a stash', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['stash', 'push', '--include-untracked'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', false);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should return the "Unable to Find Git" error message when no git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', false);

			// Assert
			expect(result).toBe('Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.');
		});

		it('Should return the "Incompatible Git Version" error message when Git is older than 2.13.2', async () => {
			// Setup
			onDidChangeGitExecutable.emit({ path: '/path/to/git', version: '2.13.1' });

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', false);

			// Assert
			expect(result).toBe('A newer version of Git (>= 2.13.2) is required for this feature. Git 2.13.1 is currently installed. Please install a newer version of Git to use this feature.');
		});
	});

	describe('openExternalDirDiff', () => {
		it('Should launch a gui directory diff (for one commit)', async () => {
			// Setup
			jest.useFakeTimers();
			mockGitSuccessOnce();

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['difftool', '--dir-diff', '-g', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^..1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnLog).toHaveBeenCalledWith('External diff tool is being opened (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^..1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)');
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('External diff tool has exited (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^..1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)'));
		});

		it('Should launch a gui directory diff (between two commits)', async () => {
			// Setup
			jest.useFakeTimers();
			mockGitSuccessOnce();

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['difftool', '--dir-diff', '-g', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b..2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnLog).toHaveBeenCalledWith('External diff tool is being opened (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b..2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c)');
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('External diff tool has exited (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b..2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c)'));
		});

		it('Should launch a gui directory diff (for uncommitted changes)', async () => {
			// Setup
			jest.useFakeTimers();
			mockGitSuccessOnce();

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', utils.UNCOMMITTED, utils.UNCOMMITTED, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['difftool', '--dir-diff', '-g', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnLog).toHaveBeenCalledWith('External diff tool is being opened (HEAD)');
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('External diff tool has exited (HEAD)'));
		});

		it('Should launch a gui directory diff (between a commit and the uncommitted changes)', async () => {
			// Setup
			jest.useFakeTimers();
			mockGitSuccessOnce();

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['difftool', '--dir-diff', '-g', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnLog).toHaveBeenCalledWith('External diff tool is being opened (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)');
			await waitForExpect(() => expect(spyOnLog).toHaveBeenCalledWith('External diff tool has exited (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)'));
		});

		it('Should launch a directory diff in a terminal (between two commits)', async () => {
			// Setup
			jest.useFakeTimers();
			const spyOnOpenGitTerminal = jest.spyOn(utils, 'openGitTerminal');
			spyOnOpenGitTerminal.mockReturnValueOnce();

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', false);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnOpenGitTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'difftool --dir-diff 1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b..2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', 'Open External Directory Diff');
		});

		it('Should return the "Unable to Find Git" error message when no git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', true);

			// Assert
			expect(result).toBe('Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.');
		});

		it('Should display the error message when the diff tool doesn\'t exit successfully', async () => {
			// Setup
			jest.useFakeTimers();
			mockGitThrowingErrorOnce('line1\nline2\nline3');
			vscode.window.showErrorMessage.mockResolvedValueOnce(null);

			// Run
			const resultPromise = dataSource.openExternalDirDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', utils.UNCOMMITTED, true);

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1500);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			const result = await resultPromise;

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['difftool', '--dir-diff', '-g', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnLog).toHaveBeenCalledWith('External diff tool is being opened (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)');
			await waitForExpect(() => {
				expect(spyOnLog).toHaveBeenCalledWith('External diff tool has exited (1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b)');
				expect(spyOnLogError).toBeCalledWith('line1 line2 line3');
				expect(vscode.window.showErrorMessage).toBeCalledWith('line1 line2 line3');
			});
		});
	});

	describe('onDidChangeConfiguration', () => {
		it('Should not trigger Git command formats to be regenerated if they are unaffected by the change', () => {
			// Setup
			const spyOnGenerateGitCommandFormats = jest.spyOn(dataSource as any, 'generateGitCommandFormats');

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.commitDetailsView.autoCenter'
			});

			// Assert
			expect(spyOnGenerateGitCommandFormats).toHaveBeenCalledTimes(0);
		});
	});

	describe('spawn other error cases', () => {
		it('Should return the "Unable to Find Git" error message when no git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.checkoutCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.');
		});

		it('Should resolve child process promise only once with cp error', async () => {
			// Setup
			mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
				stdoutOnCallbacks['close']();
				stderrOnCallbacks['close']();
				onCallbacks['error'](new Error('error message\r\nsecond line'));
				onCallbacks['exit'](0);
			});

			// Run
			const result = await dataSource.checkoutCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('error message\nsecond line');
		});

		it('Should return an empty error message thrown by git', async () => {
			// Setup
			mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
				stdoutOnCallbacks['close']();
				stderrOnCallbacks['close']();
				onCallbacks['exit'](1);
			});

			// Run
			const result = await dataSource.checkoutCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe('');
		});
	});
});
