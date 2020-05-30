import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/logger');

import { Logger } from '../src/logger';
import { RepoFileWatcher } from '../src/repoFileWatcher';

let fsWatcher = vscode.mocks.fileSystemWater;
let logger: Logger;

beforeAll(() => {
	logger = new Logger();
	jest.useFakeTimers();
});

afterAll(() => {
	logger.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
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
		let onCreateCallback: jest.Mock, onChangeCallback: jest.Mock, onDeleteCallback: jest.Mock;
		fsWatcher.onDidCreate.mockImplementationOnce((callback) => onCreateCallback = callback);
		fsWatcher.onDidChange.mockImplementationOnce((callback) => onChangeCallback = callback);
		fsWatcher.onDidDelete.mockImplementationOnce((callback) => onDeleteCallback = callback);

		// Run
		repoFileWatcher.start('/path/to/repo');
		onCreateCallback!(vscode.Uri.file('/path/to/repo/file'));
		onChangeCallback!(vscode.Uri.file('/path/to/repo/file'));
		onDeleteCallback!(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('/path/to/repo/**');
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('Should stop a previous active File System Watcher before creating a new one', () => {
		// Setup
		let onCreateCallback: jest.Mock;
		fsWatcher.onDidCreate.mockImplementationOnce((callback) => onCreateCallback = callback);

		// Run
		repoFileWatcher.start('/path/to/repo1');
		onCreateCallback!(vscode.Uri.file('/path/to/repo1/file'));
		repoFileWatcher.start('/path/to/repo2');
		jest.runOnlyPendingTimers();

		// Assert
		expect(fsWatcher.dispose).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it('Should only dispose the active File System Watcher if it exists', () => {
		// Run
		repoFileWatcher.stop();

		// Assert
		expect(fsWatcher.dispose).toHaveBeenCalledTimes(0);
	});

	it('Should ignore file system events while muted', () => {
		// Setup
		let onCreateCallback: jest.Mock;
		fsWatcher.onDidCreate.mockImplementationOnce((callback) => onCreateCallback = callback);

		// Run
		repoFileWatcher.start('/path/to/repo');
		repoFileWatcher.mute();
		onCreateCallback!(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it('Should resume reporting file events after 1.5 seconds', () => {
		// Setup
		let onCreateCallback: jest.Mock, onChangeCallback: jest.Mock;
		fsWatcher.onDidCreate.mockImplementationOnce((callback) => onCreateCallback = callback);
		fsWatcher.onDidChange.mockImplementationOnce((callback) => onChangeCallback = callback);
		date.setCurrentTime(1587559258);

		// Run 
		repoFileWatcher.start('/path/to/repo');
		repoFileWatcher.mute();
		repoFileWatcher.unmute();
		onCreateCallback!(vscode.Uri.file('/path/to/repo/file'));
		date.setCurrentTime(1587559260);
		onChangeCallback!(vscode.Uri.file('/path/to/repo/file'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('Should ignore file system events on files ignored within .git directory', () => {
		// Setup
		let onCreateCallback: jest.Mock;
		fsWatcher.onDidCreate.mockImplementationOnce((callback) => onCreateCallback = callback);

		// Run
		repoFileWatcher.start('/path/to/repo');
		onCreateCallback!(vscode.Uri.file('/path/to/repo/.git/config-x'));
		jest.runOnlyPendingTimers();

		// Assert
		expect(callback).toHaveBeenCalledTimes(0);
	});
});
