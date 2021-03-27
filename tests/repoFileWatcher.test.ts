import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/logger');

import { Logger } from '../src/logger';
import { RepoFileWatcher } from '../src/repoFileWatcher';

let logger: Logger;
let spyOnLog: jest.SpyInstance;

beforeAll(() => {
	logger = new Logger();
	spyOnLog = jest.spyOn(logger, 'log');
	jest.useFakeTimers();
});

afterAll(() => {
	logger.dispose();
});

describe('RepoFileWatcher', () => {
	let repoFileWatcher: RepoFileWatcher;
	let callback: jest.Mock;
	beforeEach(() => {
		callback = jest.fn();
		repoFileWatcher = new RepoFileWatcher(logger, callback);
	});

	it('Should start and receive file events', () => {
		// Setup
		repoFileWatcher.start('/path/to/repo');
		const onDidCreate = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidCreate).mock.calls[0][0];
		const onDidChange = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidChange).mock.calls[0][0];
		const onDidDelete = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidDelete).mock.calls[0][0];

		// Run
		onDidCreate(vscode.Uri.file('/path/to/repo/file'));
		onDidChange(vscode.Uri.file('/path/to/repo/file'));
		onDidDelete(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/repo/**');
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('Should stop a previous active File System Watcher before creating a new one', () => {
		// Setup
		repoFileWatcher.start('/path/to/repo1');
		const watcher = repoFileWatcher['fsWatcher']!;
		const onDidCreate = (<jest.Mock<any, any>>watcher.onDidCreate).mock.calls[0][0];

		// Run
		onDidCreate(vscode.Uri.file('/path/to/repo1/file'));
		repoFileWatcher.start('/path/to/repo2');
		jest.runOnlyPendingTimers();

		// Assert
		expect(<jest.Mock<any, any>>watcher.dispose).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it('Should only dispose the active File System Watcher if it exists', () => {
		// Run
		repoFileWatcher.stop();

		// Assert
		expect(spyOnLog).toHaveBeenCalledTimes(0);
	});

	it('Should ignore file system events while muted', () => {
		// Setup
		repoFileWatcher.start('/path/to/repo');
		const onDidCreate = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidCreate).mock.calls[0][0];

		// Run
		repoFileWatcher.mute();
		onDidCreate(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it('Should resume reporting file events after 1.5 seconds', () => {
		// Setup
		date.setCurrentTime(1587559258);
		repoFileWatcher.start('/path/to/repo');
		const onDidCreate = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidCreate).mock.calls[0][0];
		const onDidChange = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidChange).mock.calls[0][0];

		// Run
		repoFileWatcher.mute();
		repoFileWatcher.unmute();
		onDidCreate(vscode.Uri.file('/path/to/repo/file'));
		date.setCurrentTime(1587559260);
		onDidChange(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('Should ignore file system events on files ignored within .git directory', () => {
		// Setup
		repoFileWatcher.start('/path/to/repo');
		const onDidCreate = (<jest.Mock<any, any>>repoFileWatcher['fsWatcher']!.onDidCreate).mock.calls[0][0];

		// Run
		onDidCreate(vscode.Uri.file('/path/to/repo/.git/config-x'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(0);
	});
});
