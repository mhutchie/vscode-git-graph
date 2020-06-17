import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/askpass/askpassManager');
jest.mock('../src/logger');

import * as cp from 'child_process';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { EventEmitter } from '../src/event';
import { Logger } from '../src/logger';
import { ActionOn, GitConfigLocation, GitPushBranchMode, GitResetMode } from '../src/types';
import * as utils from '../src/utils';

let workspaceConfiguration = vscode.mocks.workspaceConfiguration;
let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<utils.GitExecutable>;
let logger: Logger;

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<utils.GitExecutable>();
	logger = new Logger();
});

afterAll(() => {
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
});

describe('DataSource', () => {
	let dataSource: DataSource;
	let spyOnSpawn: jest.SpyInstance;
	beforeEach(() => {
		dataSource = new DataSource({ path: '/path/to/git', version: '2.25.0' }, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
		spyOnSpawn = jest.spyOn(cp, 'spawn');
	});
	afterEach(() => {
		dataSource.dispose();
	});

	type OnCallbacks = { [event: string]: (...args: any[]) => void };

	const mockSpyOnSpawn = (callback: (onCallbacks: OnCallbacks, stderrOnCallbacks: OnCallbacks, stdoutOnCallbacks: OnCallbacks) => void) => {
		spyOnSpawn.mockImplementationOnce(() => {
			let onCallbacks: OnCallbacks = {}, stderrOnCallbacks: OnCallbacks = {}, stdoutOnCallbacks: OnCallbacks = {};
			setTimeout(() => {
				callback(onCallbacks, stderrOnCallbacks, stdoutOnCallbacks);
			}, 1);
			return {
				on: (event: string, callback: (...args: any[]) => void) => onCallbacks[event] = callback,
				stderr: {
					on: (event: string, callback: (...args: any[]) => void) => stderrOnCallbacks[event] = callback,
				},
				stdout: {
					on: (event: string, callback: (...args: any[]) => void) => stdoutOnCallbacks[event] = callback,
				}
			};
		});
	};

	const mockGitSuccessOnce = (stdout?: string) => {
		mockSpyOnSpawn((onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			if (stdout) stdoutOnCallbacks['data'](Buffer.from(stdout));
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['close']();
			onCallbacks['exit'](0);
		});
	};

	const mockGitThrowingErrorOnce = (errorMessage?: string) => {
		mockSpyOnSpawn((onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
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

	describe('getRepoInfo', () => {
		it('Should return the repository info', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n' +
				'  remotes/origin/develop\n' +
				'  remotes/origin/master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce(
				'98adab72e57a098a45cc36e43a6c0fda95c44f8bXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbb30d6d4d14462e09515df02a8635e83b4278c8b1 26970361eca306caa6d6bed3baf022dbd8fa404cXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbrefs/stash@{0}XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbMichael HutchisonXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1592306634XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbWIP on develop: b30d6d4 y\n' +
				'0fc3e571c275213de2b3bca9c85e852323056121XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb9157723d0856bd828800ff185ee72658ee51d19f d45009bc4224537e97b0e52883ea7ae657928fcf 9d81ce0a6cf64b6651bacd7a6c3a6ca90fd63235XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbrefs/stash@{1}XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbMichael HutchisonXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtest@mhutchie.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1592135134XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbWIP on master: 9157723 y\n'
			);

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, []);

			// Assert
			expect(result).toStrictEqual({
				branches: ['develop', 'master', 'remotes/origin/develop', 'remotes/origin/master'],
				head: 'develop',
				remotes: ['origin'],
				stashes: [
					{
						author: 'Michael Hutchison',
						baseHash: 'b30d6d4d14462e09515df02a8635e83b4278c8b1',
						date: 1592306634,
						email: 'test@mhutchie.com',
						hash: '98adab72e57a098a45cc36e43a6c0fda95c44f8b',
						message: 'WIP on develop: b30d6d4 y',
						selector: 'refs/stash@{0}',
						untrackedFilesHash: null
					},
					{
						author: 'Michael Hutchison',
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

		it('Should return the repository info (when show remote branches is FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', false, []);

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

		it('Should return the repository info (when show remote branches is FALSE)', async () => {
			// Setup
			mockGitSuccessOnce(
				'* develop\n' +
				'  master\n'
			);
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');
			workspaceConfiguration.get.mockReturnValueOnce('Author Date');
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			onDidChangeConfiguration.emit({
				affectsConfiguration: (section) => section === 'git-graph.useMailmap'
			});
			const result = await dataSource.getRepoInfo('/path/to/repo', false, []);

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

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, ['origin']);

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

		it('Should return an error message thrown by git (when getting branches)', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitSuccessOnce('origin\n');
			mockGitSuccessOnce('\n');

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, []);

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

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, []);

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

			// Run
			const result = await dataSource.getRepoInfo('/path/to/repo', true, []);

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

	describe('getUncommittedDetails', () => {
		it('Should return the uncommitted changes', async () => {
			// Setup
			mockGitSuccessOnce(['D', 'dir/deleted.txt', 'M', 'dir/modified.txt', 'R100', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce(['0	0	dir/deleted.txt', '1	1	dir/modified.txt', '2	3	', 'dir/renamed-old.txt', 'dir/renamed-new.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', 'M  dir/modified.txt', 'R  dir/renamed-new.txt', 'dir/renamed-old.txt', '?? untracked.txt'].join('\0'));
			workspaceConfiguration.get.mockReturnValueOnce(true);

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

		it('Should return the uncommitted changes (halting invalid git status response)', async () => {
			// Setup
			mockGitSuccessOnce(['M', 'dir/modified.txt', ''].join('\0'));
			mockGitSuccessOnce(['1	1	dir/modified.txt', '1	1	modified.txt', ''].join('\0'));
			mockGitSuccessOnce([' D dir/deleted.txt', ' D ', 'M  dir/modified.txt', '?? untracked.txt'].join('\0'));
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce(true);

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
			workspaceConfiguration.get.mockReturnValueOnce('cp1252');
			const spyOnDecode = jest.spyOn(iconv, 'decode');

			// Run
			const result = await dataSource.getCommitFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subdirectory/file.txt');

			// Assert
			expect(result.toString()).toBe('File contents.\n');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b:subdirectory/file.txt'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnDecode).toBeCalledWith(expect.anything(), 'cp1252');
		});

		it('Should return the file contents (falling back to utf8 if the encoding is unknown)', async () => {
			// Setup
			mockGitSuccessOnce('File contents.\n');
			workspaceConfiguration.get.mockReturnValueOnce('xyz');
			const spyOnDecode = jest.spyOn(iconv, 'decode');

			// Run
			const result = await dataSource.getCommitFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subdirectory/file.txt');

			// Assert
			expect(result.toString()).toBe('File contents.\n');
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['show', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b:subdirectory/file.txt'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnDecode).toBeCalledWith(expect.anything(), 'utf8');
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
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['log', '--format=%s', '-n', '1', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--'], expect.objectContaining({ cwd: '/path/to/repo' }));
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

	describe('getRepoSettings', () => {
		it('Should return the repositories settings', async () => {
			// Setup
			mockGitSuccessOnce(
				'user.name=Local Name\n' +
				'user.email=local@mhutchie.com\n' +
				'remote.origin.url=https://github.com/mhutchie/vscode-git-graph.git\n' +
				'remote.origin.pushurl=https://github.com/mhutchie/vscode-git-graph-push.git\n' +
				'remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*\n'
			);
			mockGitSuccessOnce(
				'user.name=Global Name\n' +
				'user.email=global@mhutchie.com\n'
			);
			mockGitSuccessOnce('origin\n');

			// Run
			const result = await dataSource.getRepoSettings('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				settings: {
					user: {
						name: {
							local: 'Local Name',
							global: 'Global Name'
						},
						email: {
							local: 'local@mhutchie.com',
							global: 'global@mhutchie.com'
						}
					},
					remotes: [
						{
							name: 'origin',
							url: 'https://github.com/mhutchie/vscode-git-graph.git',
							pushUrl: 'https://github.com/mhutchie/vscode-git-graph-push.git'
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the repositories settings', async () => {
			// Setup
			mockGitSuccessOnce(
				'user.email=local@mhutchie.com\n' +
				'remote.origin.url=https://github.com/mhutchie/vscode-git-graph.git\n'
			);
			mockGitSuccessOnce(
				'user.name=Global Name\n'
			);
			mockGitSuccessOnce('origin\n');

			// Run
			const result = await dataSource.getRepoSettings('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				settings: {
					user: {
						name: {
							local: null,
							global: 'Global Name'
						},
						email: {
							local: 'local@mhutchie.com',
							global: null
						}
					},
					remotes: [
						{
							name: 'origin',
							url: 'https://github.com/mhutchie/vscode-git-graph.git',
							pushUrl: null
						}
					]
				},
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '--local'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['--no-pager', 'config', '--list', '--global'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['remote'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();
			mockGitThrowingErrorOnce();
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getRepoSettings('/path/to/repo');

			// Assert
			expect(result).toStrictEqual({
				settings: null,
				error: 'error message'
			});
		});
	});

	describe('getTagDetails', () => {
		it('Should return the tags details', async () => {
			// Setup
			mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbMichael HutchisonXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb<mhutchie@16right.com>XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtag-message\n');

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				tagHash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
				name: 'Michael Hutchison',
				email: 'mhutchie@16right.com',
				date: 1587559258,
				message: 'tag-message',
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return the tags details (when email isn\'t enclosed by <>)', async () => {
			// Setup
			mockGitSuccessOnce('79e88e142b378f41dfd1f82d94209a7a411384edXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbMichael HutchisonXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbmhutchie@16right.comXX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb1587559258XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPbtag-message\n');

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				tagHash: '79e88e142b378f41dfd1f82d94209a7a411384ed',
				name: 'Michael Hutchison',
				email: 'mhutchie@16right.com',
				date: 1587559258,
				message: 'tag-message',
				error: null
			});
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['for-each-ref', 'refs/tags/tag-name', '--format=%(objectname)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggername)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggeremail)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(taggerdate:unix)XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb%(contents)'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.getTagDetails('/path/to/repo', 'tag-name');

			// Assert
			expect(result).toStrictEqual({
				tagHash: '',
				name: '',
				email: '',
				date: 0,
				message: '',
				error: 'error message'
			});
		});
	});

	describe('getSubmodules', () => {
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
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin',], expect.objectContaining({ cwd: '/path/to/repo' }));
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
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, '');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should add an annotated tag to a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false, 'message');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['tag', '-a', 'tag-name', '-m', 'message', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.addTag('/path/to/repo', 'tag-name', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true, '');

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
			const result = await dataSource.fetch('/path/to/repo', null, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '--all'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should fetch a specific remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', 'origin', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should fetch and prune all remotes', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', '--all', '--prune'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.fetch('/path/to/repo', null, false);

			// Assert
			expect(result).toBe('error message');
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

	describe('pushTag', () => {
		it('Should push a tag to the remote', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', 'origin');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['push', 'origin', 'tag-name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pushTag('/path/to/repo', 'tag-name', 'origin');

			// Assert
			expect(result).toBe('error message');
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
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should create a branch at a commit, and check it out', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['checkout', '-b', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.createBranch('/path/to/repo', 'develop', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', false);

			// Assert
			expect(result).toBe('error message');
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
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--delete', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should force delete the branch', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.deleteBranch('/path/to/repo', 'master', true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['branch', '--delete', '--force', 'master'], expect.objectContaining({ cwd: '/path/to/repo' }));
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
			const result = await dataSource.fetchIntoLocalBranch('/path/to/repo', 'origin', 'master', 'develop');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['fetch', 'origin', 'master:develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.fetchIntoLocalBranch('/path/to/repo', 'origin', 'master', 'develop');

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('pullBranch', () => {
		it('Should pull a remote branch into the current branch', async () => {
			// Setup
			mockGitSuccessOnce();

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

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--no-ff'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'origin/master\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and no staged changes)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should pull a remote branch into the current branch (squash and no staged changes)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitThrowingErrorOnce();

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

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['pull', 'origin', 'master', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'origin/master\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when pull fails)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.pullBranch('/path/to/repo', 'master', 'origin', false, true);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(1);
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

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (always creating a new commit)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, true, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--no-ff'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge branch \'develop\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a commit into the current branch (squash and staged changes exist)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b 0000000000000000000000000000000000000000 M      README.md');
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', ActionOn.Commit, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(3);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['commit', '-m', 'Merge commit \'1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b\''], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash and no staged changes)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(2);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash'], expect.objectContaining({ cwd: '/path/to/repo' }));
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['diff-index', 'HEAD'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (without committing)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (squash without committing)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should merge a branch into the current branch (ignore create new commit when squashing)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, true, true, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledTimes(1);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['merge', 'develop', '--squash', '--no-commit'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git (when merge fails)', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, true, false);

			// Assert
			expect(result).toBe('error message');
			expect(spyOnSpawn).toBeCalledTimes(1);
		});

		it('Should return an error message thrown by git (when commit fails)', async () => {
			// Setup
			mockGitSuccessOnce();
			mockGitSuccessOnce(':100644 100644 f592752b794040422c9d3b884f15564e6143954b 0000000000000000000000000000000000000000 M      README.md');
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.merge('/path/to/repo', 'develop', ActionOn.Branch, false, true, false);

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

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', ActionOn.Branch, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', 'develop'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should rebase the current branch on a branch (ignoring date)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', ActionOn.Branch, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', 'develop', '--ignore-date'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', ActionOn.Branch, false, false);

			// Assert
			expect(result).toBe('error message');
		});

		it('Should launch the interactive rebase of the current branch on a branch in a terminal', async () => {
			// Setup
			const spyOnRunGitCommandInNewTerminal = jest.spyOn(utils, 'runGitCommandInNewTerminal');
			spyOnRunGitCommandInNewTerminal.mockReturnValueOnce();

			// Run
			const result = await dataSource.rebase('/path/to/repo', 'develop', ActionOn.Branch, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnRunGitCommandInNewTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'rebase --interactive develop', 'Git Rebase on "develop"');
		});

		it('Should launch the interactive rebase of the current branch on a commit in a terminal', async () => {
			// Setup
			const spyOnRunGitCommandInNewTerminal = jest.spyOn(utils, 'runGitCommandInNewTerminal');
			spyOnRunGitCommandInNewTerminal.mockReturnValueOnce();

			// Run
			const result = await dataSource.rebase('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', ActionOn.Commit, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnRunGitCommandInNewTerminal).toBeCalledWith('/path/to/repo', '/path/to/git', 'rebase --interactive 1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'Git Rebase on "1a2b3c4d"');
		});

		it('Should return the "Unable to Find Git" error message when no git executable is known', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.rebase('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', ActionOn.Commit, false, true);

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

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should cherrypick a commit (with multiple parents)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 2, false, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '-m', '2', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should record origin when cherry picking a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, true, false);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '-x', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should not commit the cherrypick of a commit', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.cherrypickCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0, false, true);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['cherry-pick', '--no-commit', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

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

			// Run
			const result = await dataSource.dropCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['rebase', '--onto', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

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

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 0);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['revert', '--no-edit', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should revert a commit (with multiple parents)', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.revertCommit('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 2);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['revert', '--no-edit', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '-m', '2'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

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
			const result = await dataSource.setConfigValue('/path/to/repo', 'user.name', 'Michael Hutchison', GitConfigLocation.Global);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--global', 'user.name', 'Michael Hutchison'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should set a local config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', 'user.name', 'Michael Hutchison', GitConfigLocation.Local);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--local', 'user.name', 'Michael Hutchison'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should set a system config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', 'user.name', 'Michael Hutchison', GitConfigLocation.System);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--system', 'user.name', 'Michael Hutchison'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.setConfigValue('/path/to/repo', 'user.name', 'Michael Hutchison', GitConfigLocation.Global);

			// Assert
			expect(result).toBe('error message');
		});
	});

	describe('unsetConfigValue', () => {
		it('Should unset a global config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', 'user.name', GitConfigLocation.Global);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--global', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should unset a local config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', 'user.name', GitConfigLocation.Local);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--local', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should unset a system config value', async () => {
			// Setup
			mockGitSuccessOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', 'user.name', GitConfigLocation.System);

			// Assert
			expect(result).toBe(null);
			expect(spyOnSpawn).toBeCalledWith('/path/to/git', ['config', '--system', '--unset-all', 'user.name'], expect.objectContaining({ cwd: '/path/to/repo' }));
		});

		it('Should return an error message thrown by git', async () => {
			// Setup
			mockGitThrowingErrorOnce();

			// Run
			const result = await dataSource.unsetConfigValue('/path/to/repo', 'user.name', GitConfigLocation.Global);

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

		it('Should return the "Incompatible Git Version" error message if git is older than 2.13.2', async () => {
			// Setup
			dataSource.dispose();
			dataSource = new DataSource({ path: '/path/to/git', version: '2.13.1' }, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);

			// Run
			const result = await dataSource.pushStash('/path/to/repo', '', false);

			// Assert
			expect(result).toBe('A newer version of Git (>= 2.13.2) is required for this feature. Git 2.13.1 is currently installed. Please install a newer version of Git to use this feature.');
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
			mockSpyOnSpawn((onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
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
			mockSpyOnSpawn((onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
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
