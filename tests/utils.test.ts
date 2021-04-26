import * as date from './mocks/date';
import { mockSpyOnSpawn } from './mocks/spawn';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/dataSource');
jest.mock('../src/extensionState');
jest.mock('../src/logger');

import * as fs from 'fs';
const mockedFileSystemModule: any = {
	access: jest.fn(),
	constants: fs.constants,
	readFile: jest.fn(),
	realpath: jest.fn(),
	stat: jest.fn()
};
mockedFileSystemModule.realpath['native'] = jest.fn();
jest.doMock('fs', () => mockedFileSystemModule);

import * as cp from 'child_process';
import * as path from 'path';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { ExtensionState } from '../src/extensionState';
import { Logger } from '../src/logger';
import { GitFileStatus, PullRequestProvider, RepoDropdownOrder } from '../src/types';
import { GitExecutable, GitVersionRequirement, UNCOMMITTED, abbrevCommit, abbrevText, archive, constructIncompatibleGitVersionMessage, copyFilePathToClipboard, copyToClipboard, createPullRequest, doesFileExist, doesVersionMeetRequirement, evalPromises, findGit, getExtensionVersion, getGitExecutable, getGitExecutableFromPaths, getNonce, getPathFromStr, getPathFromUri, getRelativeTimeDiff, getRepoName, getSortedRepositoryPaths, isPathInWorkspace, openExtensionSettings, openExternalUrl, openFile, openGitTerminal, pathWithTrailingSlash, realpath, resolveSpawnOutput, resolveToSymbolicPath, showErrorMessage, showInformationMessage, viewDiff, viewDiffWithWorkingFile, viewFileAtRevision, viewScm } from '../src/utils';
import { EventEmitter } from '../src/utils/event';

import { mockRepoState } from './helpers/utils';

const extensionContext = vscode.mocks.extensionContext;
const terminal = vscode.mocks.terminal;
let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<GitExecutable>;
let logger: Logger;
let dataSource: DataSource;
let spyOnSpawn: jest.SpyInstance;

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
	logger = new Logger();
	dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
	spyOnSpawn = jest.spyOn(cp, 'spawn');
});

afterAll(() => {
	dataSource.dispose();
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

const mockSpawnGitVersionSuccessOnce = () => {
	mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
		stdoutOnCallbacks['data'](Buffer.from('git '));
		stdoutOnCallbacks['data'](Buffer.from('version 1.2.3'));
		stdoutOnCallbacks['close']();
		stderrOnCallbacks['close']();
		onCallbacks['exit'](0);
	});
};

const mockSpawnGitVersionThrowingErrorOnce = () => {
	mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
		stdoutOnCallbacks['close']();
		stderrOnCallbacks['close']();
		onCallbacks['error']();
	});
};

describe('getPathFromUri', () => {
	it('Doesn\'t affect paths using "/" as the separator', () => {
		// Run
		const path = getPathFromUri(vscode.Uri.file('/a/b/c'));

		// Assert
		expect(path).toBe('/a/b/c');
	});

	it('Replaces "\\" with "/"', () => {
		// Run
		const path = getPathFromUri(vscode.Uri.file('\\a\\b\\c'));

		// Assert
		expect(path).toBe('/a/b/c');
	});
});

describe('getPathFromStr', () => {
	it('Doesn\'t affect paths using "/" as the separator', () => {
		// Run
		const path = getPathFromStr('/a/b/c');

		// Assert
		expect(path).toBe('/a/b/c');
	});

	it('Replaces "\\" with "/"', () => {
		// Run
		const path = getPathFromStr('\\a\\b\\c');

		// Assert
		expect(path).toBe('/a/b/c');
	});
});

describe('pathWithTrailingSlash', () => {
	it('Adds trailing "/" to path', () => {
		// Run
		const path = pathWithTrailingSlash('/a/b');

		// Assert
		expect(path).toBe('/a/b/');
	});

	it('Doesn\'t add a trailing "/" to path if it already exists', () => {
		// Run
		const path = pathWithTrailingSlash('/a/b/');

		// Assert
		expect(path).toBe('/a/b/');
	});
});

describe('realpath', () => {
	it('Should return the normalised canonical absolute path', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementationOnce((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, path as string));

		// Run
		const path = await realpath('\\a\\b');

		// Assert
		expect(path).toBe('/a/b');
		expect(mockedFileSystemModule.realpath).toBeCalledWith('\\a\\b', expect.anything());
		expect(mockedFileSystemModule.realpath.native).toHaveBeenCalledTimes(0);
	});

	it('Should return the normalised canonical absolute path (using the native version realpath)', async () => {
		// Setup
		mockedFileSystemModule.realpath.native.mockImplementationOnce((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, path as string));

		// Run
		const path = await realpath('\\a\\b', true);

		// Assert
		expect(path).toBe('/a/b');
		expect(mockedFileSystemModule.realpath).toHaveBeenCalledTimes(0);
		expect(mockedFileSystemModule.realpath.native).toBeCalledWith('\\a\\b', expect.anything());
	});

	it('Should return the original path if fs.realpath returns an error', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementationOnce((_: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(new Error('message'), ''));

		// Run
		const path = await realpath('/a/b');

		// Assert
		expect(path).toBe('/a/b');
		expect(mockedFileSystemModule.realpath).toBeCalledWith('/a/b', expect.anything());
		expect(mockedFileSystemModule.realpath.native).toHaveBeenCalledTimes(0);
	});
});

describe('isPathInWorkspace', () => {
	it('Should return TRUE if a path is a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }, { uri: vscode.Uri.file('/path/to/workspace-folder2'), index: 1 }];

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe(true);
	});

	it('Should return TRUE if a path is within a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }, { uri: vscode.Uri.file('/path/to/workspace-folder2'), index: 1 }];

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder1/subfolder');

		// Assert
		expect(result).toBe(true);
	});

	it('Should return FALSE if a path is not within a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }, { uri: vscode.Uri.file('/path/to/workspace-folder2'), index: 1 }];

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder3/file');

		// Assert
		expect(result).toBe(false);
	});

	it('Should return FALSE if vscode is not running in a workspace', () => {
		// Setup
		vscode.workspace.workspaceFolders = undefined;

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe(false);
	});
});

describe('resolveToSymbolicPath', () => {
	it('Should return the original path if it matches a vscode workspace folder', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, path as string));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe('/path/to/workspace-folder1');
	});

	it('Should return the symbolic path if a vscode workspace folder resolves to it', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder1'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder1');
	});

	it('Should return the original path if it is within a vscode workspace folder', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, path as string));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1/subfolder/file.txt');

		// Assert
		expect(result).toBe('/path/to/workspace-folder1/subfolder/file.txt');
	});

	it('Should return the symbolic path if a vscode workspace folder resolves to contain it', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder1'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1/subfolder/file.txt');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder1/subfolder/file.txt');
	});

	it('Should return the symbolic path if the vscode workspace folder resolves to be contained within it', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder/dir'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder');
	});

	it('Should return the original path if the vscode workspace folder resolves to be contained within it, when it was unable to find the path correspondence', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => {
			path = path as string;
			callback(null, path === '/symbolic-folder/path/to/dir' ? path.replace('symbolic', 'workspace') : path);
		});
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/symbolic-folder/path/to/dir'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/workspace-folder/path');

		// Assert
		expect(result).toBe('/workspace-folder/path');
	});

	it('Should return the original path if it is unrelated to the vscode workspace folders', async () => {
		// Setup
		mockedFileSystemModule.realpath.mockImplementation((path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder/dir'), index: 0 }];

		// Run
		const result = await resolveToSymbolicPath('/an/unrelated/directory');

		// Assert
		expect(result).toBe('/an/unrelated/directory');
	});

	it('Should return the original path if vscode is not running in a workspace', async () => {
		// Setup
		vscode.workspace.workspaceFolders = undefined;

		// Run
		const result = await resolveToSymbolicPath('/a/b');

		// Assert
		expect(result).toBe('/a/b');
	});
});

describe('doesFileExist', () => {
	it('Should return TRUE when the file exists', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));

		// Run
		const result = await doesFileExist('file.txt');

		// Assert
		expect(result).toBe(true);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, 'file.txt', fs.constants.R_OK, expect.anything());
	});

	it('Should return FALSE when the file doesn\'t exist', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));

		// Run
		const result = await doesFileExist('file.txt');

		// Assert
		expect(result).toBe(false);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, 'file.txt', fs.constants.R_OK, expect.anything());
	});
});

describe('abbrevCommit', () => {
	it('Truncates a commit hash to eight characters', () => {
		// Run
		const abbrev = abbrevCommit('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b');

		// Assert
		expect(abbrev).toBe('1a2b3c4d');
	});

	it('Doesn\'t truncate commit hashes less than eight characters', () => {
		// Run
		const abbrev = abbrevCommit('1a2b3c');

		// Assert
		expect(abbrev).toBe('1a2b3c');
	});
});

describe('abbrevText', () => {
	it('Abbreviates strings longer the 50 characters', () => {
		// Run
		const abbrev = abbrevText('123456789012345678901234567890123456789012345678901234567890', 50);

		// Assert
		expect(abbrev).toBe('1234567890123456789012345678901234567890123456789...');
	});

	it('Keep strings that are 50 characters long', () => {
		// Run
		const abbrev = abbrevText('12345678901234567890123456789012345678901234567890', 50);

		// Assert
		expect(abbrev).toBe('12345678901234567890123456789012345678901234567890');
	});

	it('Abbreviates strings shorter than 50 characters', () => {
		// Run
		const abbrev = abbrevText('1234567890123456789012345678901234567890123456789', 50);

		// Assert
		expect(abbrev).toBe('1234567890123456789012345678901234567890123456789');
	});
});

describe('getRelativeTimeDiff', () => {
	it('Correctly formats single second', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 1);

		// Assert
		expect(diff).toBe('1 second ago');
	});

	it('Correctly formats multiple seconds', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 3);

		// Assert
		expect(diff).toBe('3 seconds ago');
	});

	it('Correctly formats single minute', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 60);

		// Assert
		expect(diff).toBe('1 minute ago');
	});

	it('Correctly formats multiple minutes', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 180);

		// Assert
		expect(diff).toBe('3 minutes ago');
	});

	it('Correctly formats single hour', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 3600);

		// Assert
		expect(diff).toBe('1 hour ago');
	});

	it('Correctly formats multiple hours', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 10800);

		// Assert
		expect(diff).toBe('3 hours ago');
	});

	it('Correctly formats single day', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 86400);

		// Assert
		expect(diff).toBe('1 day ago');
	});

	it('Correctly formats multiple days', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 259200);

		// Assert
		expect(diff).toBe('3 days ago');
	});

	it('Correctly formats single week', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 604800);

		// Assert
		expect(diff).toBe('1 week ago');
	});

	it('Correctly formats multiple weeks', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 1814400);

		// Assert
		expect(diff).toBe('3 weeks ago');
	});

	it('Correctly formats single month', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 2629800);

		// Assert
		expect(diff).toBe('1 month ago');
	});

	it('Correctly formats multiple months', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 7889400);

		// Assert
		expect(diff).toBe('3 months ago');
	});

	it('Correctly formats single year', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 31557600);

		// Assert
		expect(diff).toBe('1 year ago');
	});

	it('Correctly formats multiple years', () => {
		// Run
		const diff = getRelativeTimeDiff(date.now - 94672800);

		// Assert
		expect(diff).toBe('3 years ago');
	});
});

describe('getExtensionVersion', () => {
	it('Should return the extension\'s version number', async () => {
		// Setup
		mockedFileSystemModule.readFile.mockImplementationOnce((_: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, data: string) => void) => callback(null, '{"version":"1.2.3"}'));

		// Run
		const version = await getExtensionVersion(vscode.mocks.extensionContext);

		// Assert
		expect(version).toBe('1.2.3');
		const [path] = mockedFileSystemModule.readFile.mock.calls[0];
		expect(getPathFromStr(path)).toBe('/path/to/extension/package.json');
	});

	it('Should reject if unable to read package.json file', async () => {
		// Setup
		let rejected = false;
		mockedFileSystemModule.readFile.mockImplementationOnce((_: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, data: string) => void) => callback(new Error(), ''));

		// Run
		await getExtensionVersion(vscode.mocks.extensionContext).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});

	it('Should reject if unable to parse package.json file', async () => {
		// Setup
		let rejected = false;
		mockedFileSystemModule.readFile.mockImplementationOnce((_: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, data: string) => void) => callback(null, '{"version":"1.2.3"'));

		// Run
		await getExtensionVersion(vscode.mocks.extensionContext).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});
});

describe('getNonce', () => {
	it('Should generate a nonce 32 characters long', () => {
		// Run
		const nonce = getNonce();

		// Assert
		expect(nonce.length).toBe(32);
	});
});

describe('getRepoName', () => {
	it('Should return entire path if it contains no "/"', () => {
		// Run
		const name = getRepoName('tmp');

		// Asset
		expect(name).toBe('tmp');
	});

	it('Should return entire path if it contains a single trailing "/"', () => {
		// Run
		const name = getRepoName('c:/');

		// Asset
		expect(name).toBe('c:/');
	});

	it('Should return last path segment otherwise', () => {
		// Run
		const name = getRepoName('c:/a/b/c/d');

		// Asset
		expect(name).toBe('d');
	});

	it('Should return last path segment otherwise (with trailing "/")', () => {
		// Run
		const name = getRepoName('c:/a/b/c/d/');

		// Asset
		expect(name).toBe('d');
	});
});

describe('getSortedRepositoryPaths', () => {
	it('Should sort by RepoDropdownOrder.WorkspaceFullPath', () => {
		// Run
		const repoPaths = getSortedRepositoryPaths({
			'/path/to/workspace-1/a': mockRepoState({ workspaceFolderIndex: 1 }),
			'/path/to/workspace-2/c': mockRepoState({ workspaceFolderIndex: 0 }),
			'/path/to/workspace-3/a': mockRepoState({ workspaceFolderIndex: null }),
			'/path/to/workspace-2/b': mockRepoState({ workspaceFolderIndex: 0 }),
			'/path/to/workspace-1/b': mockRepoState({ workspaceFolderIndex: 1 }),
			'/path/to/workspace-1/d': mockRepoState({ workspaceFolderIndex: 1 }),
			'/path/to/workspace-3/b': mockRepoState({ workspaceFolderIndex: null }),
			'/path/to/workspace-3/d': mockRepoState({ workspaceFolderIndex: null }),
			'/path/to/workspace-2/a': mockRepoState({ workspaceFolderIndex: 0 }),
			'/path/to/workspace-1/c': mockRepoState({ workspaceFolderIndex: 1 }),
			'/path/to/workspace-3/c': mockRepoState({ workspaceFolderIndex: null }),
			'/path/to/workspace-2/d': mockRepoState({ workspaceFolderIndex: 0 })
		}, RepoDropdownOrder.WorkspaceFullPath);

		// Assert
		expect(repoPaths).toStrictEqual(['/path/to/workspace-2/a', '/path/to/workspace-2/b', '/path/to/workspace-2/c', '/path/to/workspace-2/d', '/path/to/workspace-1/a', '/path/to/workspace-1/b', '/path/to/workspace-1/c', '/path/to/workspace-1/d', '/path/to/workspace-3/a', '/path/to/workspace-3/b', '/path/to/workspace-3/c', '/path/to/workspace-3/d']);
	});

	it('Should sort by RepoDropdownOrder.FullPath', () => {
		// Run
		const repoPaths = getSortedRepositoryPaths({
			'/path/to/a': mockRepoState({ workspaceFolderIndex: 1 }),
			'/path/to/f': mockRepoState({ workspaceFolderIndex: 2 }),
			'/path/to/D': mockRepoState({ workspaceFolderIndex: 3 }),
			'/path/to/b': mockRepoState({ workspaceFolderIndex: 4 }),
			'/path/to/é': mockRepoState({ workspaceFolderIndex: 5 }),
			'/path/to/C': mockRepoState({ workspaceFolderIndex: 6 }),
			'/path/a': mockRepoState({ workspaceFolderIndex: 1 })
		}, RepoDropdownOrder.FullPath);

		// Assert
		expect(repoPaths).toStrictEqual(['/path/a', '/path/to/a', '/path/to/b', '/path/to/C', '/path/to/D', '/path/to/é', '/path/to/f']);
	});

	it('Should sort by RepoDropdownOrder.Name', () => {
		// Run
		const repoPaths = getSortedRepositoryPaths({
			'/path/to/a': mockRepoState({ name: null, workspaceFolderIndex: 1 }),
			'/path/to/x': mockRepoState({ name: 'f', workspaceFolderIndex: 2 }),
			'/path/to/y': mockRepoState({ name: 'D', workspaceFolderIndex: 3 }),
			'/path/to/b': mockRepoState({ name: null, workspaceFolderIndex: 4 }),
			'/path/to/z': mockRepoState({ name: 'é', workspaceFolderIndex: 5 }),
			'/path/to/C': mockRepoState({ name: null, workspaceFolderIndex: 6 }),
			'/path/to/another/A': mockRepoState({ name: null, workspaceFolderIndex: 7 }),
			'/path/a': mockRepoState({ name: null, workspaceFolderIndex: 1 })
		}, RepoDropdownOrder.Name);

		// Assert
		expect(repoPaths).toStrictEqual(['/path/a', '/path/to/a', '/path/to/another/A', '/path/to/b', '/path/to/C', '/path/to/y', '/path/to/z', '/path/to/x']);
	});
});

describe('archive', () => {
	it('Should trigger the creation of the archive (tar)', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(vscode.Uri.file('/archive/file/destination.tar'));
		const spyOnArchive = jest.spyOn(dataSource, 'archive');
		spyOnArchive.mockResolvedValueOnce(null);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe(null);
		expect(spyOnArchive).toBeCalledWith('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/archive/file/destination.tar', 'tar');
	});

	it('Should trigger the creation of the archive (TAR)', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(vscode.Uri.file('/archive/file/destination.TAR'));
		const spyOnArchive = jest.spyOn(dataSource, 'archive');
		spyOnArchive.mockResolvedValueOnce(null);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe(null);
		expect(spyOnArchive).toBeCalledWith('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/archive/file/destination.TAR', 'tar');
	});

	it('Should trigger the creation of the archive (zip)', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(vscode.Uri.file('/archive/file/destination.zip'));
		const spyOnArchive = jest.spyOn(dataSource, 'archive');
		spyOnArchive.mockResolvedValueOnce(null);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe(null);
		expect(spyOnArchive).toBeCalledWith('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/archive/file/destination.zip', 'zip');
	});

	it('Should trigger the creation of the archive (ZIP)', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(vscode.Uri.file('/archive/file/destination.ZIP'));
		const spyOnArchive = jest.spyOn(dataSource, 'archive');
		spyOnArchive.mockResolvedValueOnce(null);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe(null);
		expect(spyOnArchive).toBeCalledWith('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/archive/file/destination.ZIP', 'zip');
	});

	it('Should return an error message when the specified archive destination has an invalid file extension', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(vscode.Uri.file('/archive/file/destination.txt'));

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe('Invalid file extension "*.txt". The archive file must have a *.tar or *.zip extension.');
	});

	it('Should return an error message when no file is specified for the archive', async () => {
		// Setup
		vscode.window.showSaveDialog.mockResolvedValueOnce(undefined);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe('No file name was provided for the archive.');
	});

	it('Should return an error message when vscode fails to show the Save Dialog', async () => {
		// Setup
		vscode.window.showSaveDialog.mockRejectedValueOnce(undefined);

		// Run
		const result = await archive('/repo/path', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe('Visual Studio Code was unable to display the save dialog.');
	});
});

describe('copyFilePathToClipboard', () => {
	it('Appends the relative file path to the repository path, and copies the result to the clipboard', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockResolvedValueOnce(null);

		// Run
		const result = await copyFilePathToClipboard('/a/b', 'c/d.txt', true);

		// Assert
		const receivedArgs: any[] = vscode.env.clipboard.writeText.mock.calls[0];
		expect(result).toBe(null);
		expect(getPathFromStr(receivedArgs[0])).toBe('/a/b/c/d.txt');
	});

	it('Copies the relative file path to the clipboard', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockResolvedValueOnce(null);

		// Run
		const result = await copyFilePathToClipboard('/a/b', 'c/d.txt', false);

		// Assert
		const receivedArgs: any[] = vscode.env.clipboard.writeText.mock.calls[0];
		expect(result).toBe(null);
		expect(getPathFromStr(receivedArgs[0])).toBe('c/d.txt');
	});

	it('Returns an error message when writeText fails', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockRejectedValueOnce(null);

		// Run
		const result = await copyFilePathToClipboard('/a/b', 'c/d.txt', true);

		// Assert
		expect(result).toBe('Visual Studio Code was unable to write to the Clipboard.');
	});
});

describe('copyToClipboard', () => {
	it('Copies text to the clipboard', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockResolvedValueOnce(null);

		// Run
		const result = await copyToClipboard('');

		// Assert
		expect(result).toBe(null);
	});

	it('Returns an error message when writeText fails', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockRejectedValueOnce(null);

		// Run
		const result = await copyToClipboard('');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to write to the Clipboard.');
	});
});

describe('createPullRequest', () => {
	it('Should construct and open a BitBucket Pull Request Creation Url', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.Bitbucket,
			custom: null,
			hostRootUrl: 'https://bitbucket.org',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: 'destProjectId'
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://bitbucket.org/sourceOwner/sourceRepo/pull-requests/new?source=sourceOwner/sourceRepo::sourceBranch&dest=destOwner/destRepo::destBranch');
	});

	it('Should construct and open a Custom Providers Pull Request Creation Url', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.Custom,
			custom: {
				name: 'custom',
				templateUrl: '$1/$2/$3/$4/$5/$6/$8'
			},
			hostRootUrl: 'https://example.com',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: 'destProjectId'
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://example.com/sourceOwner/sourceRepo/sourceBranch/destOwner/destRepo/destBranch');
	});

	it('Should construct and open a GitHub Pull Request Creation Url', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.GitHub,
			custom: null,
			hostRootUrl: 'https://github.com',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: 'destProjectId'
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://github.com/destOwner/destRepo/compare/destBranch...sourceOwner:sourceBranch');
	});

	it('Should construct and open a GitLab Pull Request Creation Url', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.GitLab,
			custom: null,
			hostRootUrl: 'https://gitlab.com',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: 'destProjectId'
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://gitlab.com/sourceOwner/sourceRepo/-/merge_requests/new?merge_request[source_branch]=sourceBranch&merge_request[target_branch]=destBranch&merge_request[target_project_id]=destProjectId');
	});

	it('Should construct and open a GitLab Pull Request Creation Url (without destProjectId)', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.GitLab,
			custom: null,
			hostRootUrl: 'https://gitlab.com',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: ''
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://gitlab.com/sourceOwner/sourceRepo/-/merge_requests/new?merge_request[source_branch]=sourceBranch&merge_request[target_branch]=destBranch');
	});

	it('Should return an error message if vscode was unable to open the url', async () => {
		// Setup
		vscode.env.openExternal.mockRejectedValueOnce(null);

		// Run
		const result = await createPullRequest({
			provider: PullRequestProvider.GitHub,
			custom: null,
			hostRootUrl: 'https://github.com',
			sourceOwner: 'sourceOwner',
			sourceRepo: 'sourceRepo',
			sourceRemote: 'sourceRemote',
			destOwner: 'destOwner',
			destRepo: 'destRepo',
			destBranch: 'destBranch',
			destRemote: 'destRemote',
			destProjectId: 'destProjectId'
		}, 'sourceOwner', 'sourceRepo', 'sourceBranch');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the Pull Request URL: https://github.com/destOwner/destRepo/compare/destBranch...sourceOwner:sourceBranch');
	});
});

describe('openExtensionSettings', () => {
	it('Executes workbench.action.openSettings', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await openExtensionSettings();

		// Assert
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', '@ext:mhutchie.git-graph');
		expect(result).toBe(null);
	});

	it('Returns an error message when executeCommand fails', async () => {
		// Setup
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await openExtensionSettings();

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the Git Graph Extension Settings.');
	});
});

describe('openExternalUrl', () => {
	it('Should open the URL via Visual Studio Code', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(true);

		// Run
		const result = await openExternalUrl('https://github.com/mhutchie/vscode-git-graph');

		// Assert
		expect(result).toBe(null);
		expect(vscode.env.openExternal.mock.calls[0][0].toString()).toBe('https://github.com/mhutchie/vscode-git-graph');
	});

	it('Should return an error message if vscode was unable to open the url (vscode.env.openExternal resolves FALSE)', async () => {
		// Setup
		vscode.env.openExternal.mockResolvedValueOnce(false);

		// Run
		const result = await openExternalUrl('https://github.com/mhutchie/vscode-git-graph');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the External URL: https://github.com/mhutchie/vscode-git-graph');
	});

	it('Should return an error message if vscode was unable to open the url (vscode.env.openExternal rejects)', async () => {
		// Setup
		vscode.env.openExternal.mockRejectedValueOnce(null);

		// Run
		const result = await openExternalUrl('https://github.com/mhutchie/vscode-git-graph');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the External URL: https://github.com/mhutchie/vscode-git-graph');
	});

	it('Should return an error message if vscode was unable to parse the url', async () => {
		// Setup
		const spyOnParse = jest.spyOn(vscode.Uri, 'parse');
		spyOnParse.mockImplementationOnce(() => {
			throw new Error();
		});

		// Run
		const result = await openExternalUrl('https://github.com/mhutchie/vscode-git-graph');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the External URL: https://github.com/mhutchie/vscode-git-graph');
		expect(vscode.env.openExternal).not.toHaveBeenCalled();
	});

	it('Should return an error message with a custom type', async () => {
		// Setup
		vscode.env.openExternal.mockRejectedValueOnce(null);

		// Run
		const result = await openExternalUrl('https://github.com/mhutchie/vscode-git-graph', 'Custom URL');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the Custom URL: https://github.com/mhutchie/vscode-git-graph');
	});
});

describe('openFile', () => {
	it('Should open the file in vscode (with the user defined ViewColumn)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await openFile('/path/to/repo', 'file.txt');

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(getPathFromUri(uri)).toBe('/path/to/repo/file.txt');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'file.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should open the file in vscode (in the specified ViewColumn)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await openFile('/path/to/repo', 'file.txt', null, null, vscode.ViewColumn.Beside);

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(getPathFromUri(uri)).toBe('/path/to/repo/file.txt');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Beside
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'file.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should open a renamed file in vscode', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce('renamed-new.txt');

		// Run
		const result = await openFile('/path/to/repo', 'renamed-old.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(getPathFromUri(uri)).toBe('/path/to/repo/renamed-new.txt');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'renamed-old.txt'), fs.constants.R_OK, expect.anything());
		expect(spyOnGetNewPathOfRenamedFile).toHaveBeenCalledWith('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'renamed-old.txt');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(2, path.join('/path/to/repo', 'renamed-new.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should return an error message if vscode was unable to open the file', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await openFile('/path/to/repo', 'file.txt');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open file.txt.');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'file.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should return an error message if the file doesn\'t exist in the repository', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));

		// Run
		const result = await openFile('/path/to/repo', 'deleted.txt');

		// Assert
		expect(result).toBe('The file deleted.txt doesn\'t currently exist in this repository.');
		expect(mockedFileSystemModule.access).toHaveBeenCalledTimes(1);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'deleted.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should return an error message if the file doesn\'t exist in the repository, and it wasn\'t renamed', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce(null);

		// Run
		const result = await openFile('/path/to/repo', 'deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe('The file deleted.txt doesn\'t currently exist in this repository.');
		expect(mockedFileSystemModule.access).toHaveBeenCalledTimes(1);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'deleted.txt'), fs.constants.R_OK, expect.anything());
		expect(spyOnGetNewPathOfRenamedFile).toHaveBeenCalledWith('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'deleted.txt');
	});

	it('Should return an error message if the file doesn\'t exist in the repository, and it was renamed', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce('renamed-new.txt');

		// Run
		const result = await openFile('/path/to/repo', 'renamed-old.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', dataSource);

		// Assert
		expect(result).toBe('The file renamed-old.txt doesn\'t currently exist in this repository.');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'renamed-old.txt'), fs.constants.R_OK, expect.anything());
		expect(spyOnGetNewPathOfRenamedFile).toHaveBeenCalledWith('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'renamed-old.txt');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(2, path.join('/path/to/repo', 'renamed-new.txt'), fs.constants.R_OK, expect.anything());
	});
});

describe('viewDiff', () => {
	it('Should load the vscode diff view (single commit, file added)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '/path/to/repo', false));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(title).toBe('added.txt (Added in 1a2b3c4d)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (single commit, file modified)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(title).toBe('modified.txt (1a2b3c4d^ ↔ 1a2b3c4d)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (single commit, file deleted)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b^', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', false));
		expect(title).toBe('deleted.txt (Deleted in 1a2b3c4d)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commits, file added)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', false));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '/path/to/repo', true));
		expect(title).toBe('added.txt (Added between 1a2b3c4d & a1b2c3d4)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commits, file modified)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '/path/to/repo', true));
		expect(title).toBe('modified.txt (1a2b3c4d ↔ a1b2c3d4)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commits, file deleted)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '/path/to/repo', false));
		expect(title).toBe('deleted.txt (Deleted between 1a2b3c4d & a1b2c3d4)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commit and uncommitted changes, file added)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', UNCOMMITTED, 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', false));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/added.txt');
		expect(title).toBe('added.txt (Added between 1a2b3c4d & Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commit and uncommitted changes, file modified)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', UNCOMMITTED, 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/modified.txt');
		expect(title).toBe('modified.txt (1a2b3c4d ↔ Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (between commit and uncommitted changes, file deleted)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', UNCOMMITTED, 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '*', '/path/to/repo', false));
		expect(title).toBe('deleted.txt (Deleted between 1a2b3c4d & Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (uncommitted changes, file added)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', UNCOMMITTED, UNCOMMITTED, 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/added.txt', 'HEAD', '/path/to/repo', false));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/added.txt');
		expect(title).toBe('added.txt (Uncommitted)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (uncommitted changes, file modified)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', UNCOMMITTED, UNCOMMITTED, 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', 'HEAD', '/path/to/repo', true));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/modified.txt');
		expect(title).toBe('modified.txt (Uncommitted)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should load the vscode diff view (uncommitted changes, file deleted)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', UNCOMMITTED, UNCOMMITTED, 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', 'HEAD', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '*', '/path/to/repo', false));
		expect(title).toBe('deleted.txt (Uncommitted)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should return an error message when vscode was unable to load the diff view', async () => {
		// Setup
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		expect(result).toBe('Visual Studio Code was unable to load the diff editor for subfolder/modified.txt.');
	});

	it('Should open an untracked file in vscode', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', UNCOMMITTED, UNCOMMITTED, 'subfolder/untracked.txt', 'subfolder/untracked.txt', GitFileStatus.Untracked);

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(getPathFromUri(uri)).toBe('/path/to/repo/subfolder/untracked.txt');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/untracked.txt'), fs.constants.R_OK, expect.anything());
	});
});

describe('viewDiffWithWorkingFile', () => {
	it('Should load the vscode diff view (modified file)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiffWithWorkingFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/modified.txt', dataSource);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/modified.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/modified.txt');
		expect(title).toBe('modified.txt (1a2b3c4d ↔ Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/modified.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should load the vscode diff view (renamed file)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce('subfolder/renamed-new.txt');

		// Run
		const result = await viewDiffWithWorkingFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/renamed-old.txt', dataSource);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/renamed-old.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(getPathFromUri(rightUri)).toBe('/path/to/repo/subfolder/renamed-new.txt');
		expect(title).toBe('renamed-new.txt (1a2b3c4d ↔ Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/renamed-old.txt'), fs.constants.R_OK, expect.anything());
		expect(spyOnGetNewPathOfRenamedFile).toHaveBeenCalledWith('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/renamed-old.txt');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(2, path.join('/path/to/repo', 'subfolder/renamed-new.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should load the vscode diff view (deleted file)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiffWithWorkingFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/deleted.txt', dataSource);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/deleted.txt', '*', '/path/to/repo', false));
		expect(title).toBe('deleted.txt (Deleted between 1a2b3c4d & Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenCalledTimes(1);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/deleted.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should load the vscode diff view (renamed and deleted file)', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(new Error()));
		vscode.commands.executeCommand.mockResolvedValueOnce(null);
		const spyOnGetNewPathOfRenamedFile = jest.spyOn(dataSource, 'getNewPathOfRenamedFile');
		spyOnGetNewPathOfRenamedFile.mockResolvedValueOnce('subfolder/renamed-new.txt');

		// Run
		const result = await viewDiffWithWorkingFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/renamed-old.txt', dataSource);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe(expectedValueGitGraphUri('subfolder/renamed-old.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true));
		expect(rightUri.toString()).toBe(expectedValueGitGraphUri('subfolder/renamed-old.txt', '*', '/path/to/repo', false));
		expect(title).toBe('renamed-old.txt (Deleted between 1a2b3c4d & Present)');
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/renamed-old.txt'), fs.constants.R_OK, expect.anything());
		expect(spyOnGetNewPathOfRenamedFile).toHaveBeenCalledWith('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/renamed-old.txt');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(2, path.join('/path/to/repo', 'subfolder/renamed-new.txt'), fs.constants.R_OK, expect.anything());
	});

	it('Should return an error message when vscode was unable to load the diff view', async () => {
		// Setup
		mockedFileSystemModule.access.mockImplementationOnce((_1: fs.PathLike, _2: number | undefined, callback: (err: NodeJS.ErrnoException | null) => void) => callback(null));
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await viewDiffWithWorkingFile('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/modified.txt', dataSource);

		// Assert
		expect(result).toBe('Visual Studio Code was unable to load the diff editor for subfolder/modified.txt.');
		expect(mockedFileSystemModule.access).toHaveBeenNthCalledWith(1, path.join('/path/to/repo', 'subfolder/modified.txt'), fs.constants.R_OK, expect.anything());
	});
});

describe('viewFileAtRevision', () => {
	it('Should open the file in vscode', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewFileAtRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/file.txt');

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(uri.toString()).toBe(expectedValueGitGraphUri('subfolder/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', '/path/to/repo', true).replace('file.txt', '1a2b3c4d: file.txt'));
		expect(config).toStrictEqual({
			preview: true,
			viewColumn: vscode.ViewColumn.Active
		});
		expect(result).toBe(null);
	});

	it('Should return an error message if vscode was unable to open the file', async () => {
		// Setup
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await viewFileAtRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'subfolder/file.txt');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open subfolder/file.txt at commit 1a2b3c4d.');
	});
});

describe('viewScm', () => {
	it('Executes workbench.view.scm', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewScm();

		// Assert
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.view.scm');
		expect(result).toBe(null);
	});

	it('Returns an error message when executeCommand fails', async () => {
		// Setup
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await viewScm();

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open the Source Control View.');
	});
});

describe('openGitTerminal', () => {
	let ostype: string | undefined, path: string | undefined, platform: NodeJS.Platform;
	beforeEach(() => {
		ostype = process.env.OSTYPE;
		path = process.env.PATH;
		platform = process.platform;
		process.env.OSTYPE = 'x';
		process.env.PATH = '/path/to/executable';
		Object.defineProperty(process, 'platform', { value: 'y' });
	});
	afterEach(() => {
		process.env.OSTYPE = ostype;
		process.env.PATH = path;
		Object.defineProperty(process, 'platform', { value: platform });
	});

	it('Should open a new terminal', () => {
		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', null, 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable:/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledTimes(0);
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command', () => {
		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable:/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (with initially empty PATH)', () => {
		// Setup
		process.env.PATH = '';

		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (with specific shell path)', () => {
		// Setup
		vscode.mockExtensionSettingReturnValue('integratedTerminalShell', '/path/to/shell');

		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable:/path/to/git'
			},
			name: 'Git Graph: Name',
			shellPath: '/path/to/shell'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (platform: win32)', () => {
		// Setup
		Object.defineProperty(process, 'platform', { value: 'win32' });

		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (ostype: cygwin)', () => {
		// Setup
		process.env.OSTYPE = 'cygwin';

		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (ostype: msys)', () => {
		// Setup
		process.env.OSTYPE = 'msys';

		// Run
		openGitTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Git Graph: Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});
});

describe('showInformationMessage', () => {
	it('Should show an information message (resolves)', async () => {
		// Setup
		vscode.window.showInformationMessage.mockResolvedValueOnce(null);

		// Run
		await showInformationMessage('Message');

		// Assert
		expect(vscode.window.showInformationMessage).toBeCalledWith('Message');
	});

	it('Should show an information message (rejects)', async () => {
		// Setup
		vscode.window.showInformationMessage.mockRejectedValueOnce(null);

		// Run
		await showInformationMessage('Message');

		// Assert
		expect(vscode.window.showInformationMessage).toBeCalledWith('Message');
	});
});

describe('showErrorMessage', () => {
	it('Should show an error message (resolves)', async () => {
		// Setup
		vscode.window.showErrorMessage.mockResolvedValueOnce(null);

		// Run
		await showErrorMessage('Message');

		// Assert
		expect(vscode.window.showErrorMessage).toBeCalledWith('Message');
	});

	it('Should show an error message (rejects)', async () => {
		// Setup
		vscode.window.showErrorMessage.mockRejectedValueOnce(null);

		// Run
		await showErrorMessage('Message');

		// Assert
		expect(vscode.window.showErrorMessage).toBeCalledWith('Message');
	});
});

describe('evalPromises', () => {
	it('Should evaluate promises in parallel (one item in array)', async () => {
		// Run
		const result = await evalPromises([1], 2, (x) => Promise.resolve(x * 2));

		// Assert
		expect(result).toStrictEqual([2]);
	});

	it('Should evaluate promises in parallel (one item in array that rejects)', async () => {
		// Setup
		let rejected = false;

		// Run
		await evalPromises([1], 2, (x) => Promise.reject(x * 2)).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});

	it('Should evaluate promises in parallel (empty array)', async () => {
		// Run
		const result = await evalPromises([], 2, (x) => Promise.resolve(x * 2));

		// Assert
		expect(result).toStrictEqual([]);
	});

	it('Should evaluate promises in parallel', async () => {
		// Run
		const result = await evalPromises([1, 2, 3, 4], 2, (x) => Promise.resolve(x * 2));

		// Assert
		expect(result).toStrictEqual([2, 4, 6, 8]);
	});

	it('Should evaluate promises in parallel that reject', async () => {
		// Setup
		let rejected = false;

		// Run
		await evalPromises([1, 2, 3, 4], 2, (x) => Promise.reject(x * 2)).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});

	it('Should evaluate promises in parallel (first rejects)', async () => {
		// Setup
		const prom1 = new Promise((_, reject) => setTimeout(reject, 1));
		const prom2 = prom1.catch(() => 1);

		// Run
		const result = await evalPromises([1, 2, 3, 4], 2, (x) => x === 1 ? prom1 : prom2).catch(() => -1);

		// Assert
		expect(result).toBe(-1);
	});
});

describe('resolveSpawnOutput', () => {
	it('Should resolve child process promise only once (error event first)', async () => {
		// Setup
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['close']();
			onCallbacks['error']('error');
			onCallbacks['exit'](0);
		});

		// Run
		const result = await resolveSpawnOutput(cp.spawn('/path/to/git', ['arg0', 'arg1']));

		// Assert
		expect(result).toStrictEqual([
			{ code: -1, error: 'error' },
			expect.any(Buffer),
			''
		]);
	});

	it('Should resolve child process promise only once (exit event first)', async () => {
		// Setup
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['close']();
			onCallbacks['exit'](1);
			onCallbacks['error']('error');
		});

		// Run
		const result = await resolveSpawnOutput(cp.spawn('/path/to/git', ['arg0', 'arg1']));

		// Assert
		expect(result).toStrictEqual([
			{ code: 1, error: null },
			expect.any(Buffer),
			''
		]);
	});
});

describe('findGit', () => {
	let onDidChangeGitExecutable: EventEmitter<GitExecutable>, extensionState: ExtensionState, platform: NodeJS.Platform;
	beforeAll(() => {
		onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
	});
	afterAll(() => {
		onDidChangeGitExecutable.dispose();
	});
	beforeEach(() => {
		extensionState = new ExtensionState(extensionContext, onDidChangeGitExecutable.subscribe);
		platform = process.platform;
		Object.defineProperty(process, 'platform', { value: 'y' });
	});
	afterEach(() => {
		extensionState.dispose();
		Object.defineProperty(process, 'platform', { value: platform });
	});

	it('Should use the last known Git executable path if it still exists', async () => {
		// Setup
		jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce('/path/to/git');
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await findGit(extensionState);

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/git',
			version: '1.2.3'
		});
		expect(spyOnSpawn).toHaveBeenCalledWith('/path/to/git', ['--version']);
	});

	it('Should use the users git.path if the last known Git executable path no longer exists', async () => {
		// Setup
		jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce('/path/to/not-git');
		vscode.mockExtensionSettingReturnValue('path', '/path/to/git');
		mockSpawnGitVersionThrowingErrorOnce();
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await findGit(extensionState);

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/git',
			version: '1.2.3'
		});
		expect(spyOnSpawn).toHaveBeenCalledWith('/path/to/git', ['--version']);
	});

	it('Should use the users git.path if there is no last known Git executable path', async () => {
		// Setup
		jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce(null);
		vscode.mockExtensionSettingReturnValue('path', '/path/to/git');
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await findGit(extensionState);

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/git',
			version: '1.2.3'
		});
		expect(spyOnSpawn).toHaveBeenCalledWith('/path/to/git', ['--version']);
	});

	describe('process.platform === \'darwin\'', () => {
		let spyOnExec: jest.SpyInstance;
		beforeEach(() => {
			jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce(null);
			vscode.mockExtensionSettingReturnValue('path', null);
			Object.defineProperty(process, 'platform', { value: 'darwin' });
			spyOnExec = jest.spyOn(cp, 'exec');
		});

		it('Should find and return the Git executable using "which git"', async () => {
			// Setup
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(null, '/path/to/git', '');
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(result).toStrictEqual({
				path: '/path/to/git',
				version: '1.2.3'
			});
		});

		it('Should find and return the Git executable using when XCode & Git are installed', async () => {
			// Setup
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(null, '/usr/bin/git', '');
			});
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null) => void) => {
				expect(command).toBe('xcode-select -p');
				callback(null);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(result).toStrictEqual({
				path: '/usr/bin/git',
				version: '1.2.3'
			});
		});

		it('Should reject when "which git" throws an error', async () => {
			// Setup
			let rejected = false;
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(new Error(), '', '');
			});

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});

		it('Should reject when "which git" succeeds, but failed to get Git executable', async () => {
			// Setup
			let rejected = false;
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(null, '/path/to/git', '');
			});
			mockSpawnGitVersionThrowingErrorOnce();

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});

		it('Should reject when "xcode-select -p" fails with exit code 2', async () => {
			// Setup
			let rejected = false;
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(null, '/usr/bin/git', '');
			});
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null) => void) => {
				expect(command).toBe('xcode-select -p');
				callback(null);
			});
			mockSpawnGitVersionThrowingErrorOnce();

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});

		it('Should reject when "xcode-select -p" succeeds, but failed to get Git executable', async () => {
			// Setup
			let rejected = false;
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
				expect(command).toBe('which git');
				callback(null, '/usr/bin/git', '');
			});
			spyOnExec.mockImplementationOnce((command: string, callback: (error: Error | null) => void) => {
				expect(command).toBe('xcode-select -p');
				callback({ code: 2 } as any);
			});

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});
	});

	describe('process.platform === \'win32\'', () => {
		let programW6432: string | undefined, programFilesX86: string | undefined, programFiles: string | undefined, localAppData: string | undefined, envPath: string | undefined;
		beforeEach(() => {
			jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce(null);
			vscode.mockExtensionSettingReturnValue('path', []);
			programW6432 = process.env['ProgramW6432'];
			programFilesX86 = process.env['ProgramFiles(x86)'];
			programFiles = process.env['ProgramFiles'];
			localAppData = process.env['LocalAppData'];
			envPath = process.env['PATH'];
			Object.defineProperty(process, 'platform', { value: 'win32' });
		});
		afterEach(() => {
			process.env['ProgramW6432'] = programW6432;
			process.env['ProgramFiles(x86)'] = programFilesX86;
			process.env['ProgramFiles'] = programFiles;
			process.env['LocalAppData'] = localAppData;
			process.env['PATH'] = envPath;
		});

		it('Should find Git in ProgramW6432', async () => {
			// Setup
			process.env['ProgramW6432'] = 'c:/path/to/ProgramW6432';
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/ProgramW6432/Git/cmd/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in ProgramFiles(x86)', async () => {
			// Setup
			process.env['ProgramFiles(x86)'] = 'c:/path/to/ProgramFilesX86';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/ProgramFilesX86/Git/cmd/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in ProgramFiles', async () => {
			// Setup
			process.env['ProgramFiles'] = 'c:/path/to/ProgramFiles';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/ProgramFiles/Git/cmd/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in LocalAppData', async () => {
			// Setup
			process.env['LocalAppData'] = 'c:/path/to/LocalAppData';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/LocalAppData/Programs/Git/cmd/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in PATH (isFile)', async () => {
			// Setup
			process.env['PATH'] = 'c:/path/to/git-dir';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockedFileSystemModule.stat.mockImplementation((statPath: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => getPathFromStr(statPath as string) === 'c:/path/to/git-dir/git.exe', isSymbolicLink: () => false } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/git-dir/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in PATH (isSymbolicLink)', async () => {
			// Setup
			delete process.env['LocalAppData'];
			process.env['PATH'] = 'c:/path/to/git-dir';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockedFileSystemModule.stat.mockImplementation((statPath: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => false, isSymbolicLink: () => getPathFromStr(statPath as string) === 'c:/path/to/git-dir/git.exe' } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/git-dir/git.exe');
			expect(result.version).toBe('1.2.3');
		});

		it('Should find Git in CWD', async () => {
			// Setup
			delete process.env['PATH'];
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			const gitPath = getPathFromStr(path.join(process.cwd(), 'git.exe'));
			mockedFileSystemModule.stat.mockImplementation((statPath: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => getPathFromStr(statPath as string) === gitPath, isSymbolicLink: () => false } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe(gitPath);
			expect(result.version).toBe('1.2.3');
		});

		it('Should reject when Git executable not in PATH', async () => {
			// Setup
			let rejected = false;
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockedFileSystemModule.stat.mockImplementation((_: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => false, isSymbolicLink: () => false } as any);
			});

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});
	});

	describe('process.platform === \'unknown\'', () => {
		beforeEach(() => {
			jest.spyOn(extensionState, 'getLastKnownGitPath').mockReturnValueOnce(null);
			vscode.mockExtensionSettingReturnValue('path', null);
			Object.defineProperty(process, 'platform', { value: 'unknown' });
		});

		it('Should return the Git executable', async () => {
			// Setup
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(result).toStrictEqual({
				path: 'git',
				version: '1.2.3'
			});
		});

		it('Should reject when the Git executable doesn\'t exist', async () => {
			// Setup
			let rejected = false;
			mockSpawnGitVersionThrowingErrorOnce();

			// Run
			await findGit(extensionState).catch(() => rejected = true);

			// Assert
			expect(rejected).toBe(true);
		});
	});
});

describe('getGitExecutable', () => {
	it('Should return the git version information', async () => {
		// Setup
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await getGitExecutable('/path/to/git');

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/git',
			version: '1.2.3'
		});
	});

	it('Should reject when an error is thrown', async () => {
		// Setup
		let rejected = false;
		mockSpawnGitVersionThrowingErrorOnce();

		// Run
		await getGitExecutable('/path/to/git').catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});

	it('Should reject when the command exits with a non-zero exit code', async () => {
		// Setup
		let rejected = false;
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['close']();
			onCallbacks['exit'](1);
		});

		// Run
		await getGitExecutable('/path/to/git').catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});

	it('Should reject when the command exits with a signal', async () => {
		// Setup
		let rejected = false;
		mockSpyOnSpawn(spyOnSpawn, (onCallbacks, stderrOnCallbacks, stdoutOnCallbacks) => {
			stdoutOnCallbacks['close']();
			stderrOnCallbacks['close']();
			onCallbacks['exit'](null, 'signal');
		});

		// Run
		await getGitExecutable('/path/to/git').catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});
});

describe('getGitExecutableFromPaths', () => {
	it('Should return the git version information from the first valid path (all valid)', async () => {
		// Setup
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await getGitExecutableFromPaths(['/path/to/first/git', '/path/to/second/git']);

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/first/git',
			version: '1.2.3'
		});
		expect(spyOnSpawn).toBeCalledTimes(1);
	});

	it('Should return the git version information from the first valid path (first invalid)', async () => {
		// Setup
		mockSpawnGitVersionThrowingErrorOnce();
		mockSpawnGitVersionSuccessOnce();

		// Run
		const result = await getGitExecutableFromPaths(['/path/to/first/git', '/path/to/second/git']);

		// Assert
		expect(result).toStrictEqual({
			path: '/path/to/second/git',
			version: '1.2.3'
		});
		expect(spyOnSpawn).toBeCalledTimes(2);
	});

	it('Should reject when none of the provided paths are valid Git executables', async () => {
		// Setup
		let rejected = false;
		mockSpawnGitVersionThrowingErrorOnce();
		mockSpawnGitVersionThrowingErrorOnce();

		// Run
		await getGitExecutableFromPaths(['/path/to/first/git', '/path/to/second/git']).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
		expect(spyOnSpawn).toBeCalledTimes(2);
	});

	it('Should reject when no paths are provided', async () => {
		// Setup
		let rejected = false;

		// Run
		await getGitExecutableFromPaths([]).catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
		expect(spyOnSpawn).toBeCalledTimes(0);
	});
});

describe('doesVersionMeetRequirement', () => {
	it('Should correctly determine major newer', () => {
		// Run
		const result = doesVersionMeetRequirement('2.7.8.windows.0', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major older', () => {
		// Run
		const result = doesVersionMeetRequirement('0.7.8.windows.0', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine minor newer', () => {
		// Run
		const result = doesVersionMeetRequirement('1.8.8 (Apple Git-122.3)', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine minor older', () => {
		// Run
		const result = doesVersionMeetRequirement('1.6.8 (Apple Git-122.3)', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine patch newer', () => {
		// Run
		const result = doesVersionMeetRequirement('1.7.9', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine patch older', () => {
		// Run
		const result = doesVersionMeetRequirement('1.7.7', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine same version', () => {
		// Run
		const result = doesVersionMeetRequirement('1.7.8', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major newer if missing patch version', () => {
		// Run
		const result = doesVersionMeetRequirement('2.7', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major newer if missing minor & patch versions', () => {
		// Run
		const result = doesVersionMeetRequirement('2', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});

	it('Should only use the valid portion of the version number to compute the result', () => {
		// Run
		const result1 = doesVersionMeetRequirement('1.7..8-windows.0', GitVersionRequirement.TagDetails);

		// Assert
		expect(result1).toBe(false);

		// Run
		const result2 = doesVersionMeetRequirement('1.8..7-windows.0', GitVersionRequirement.TagDetails);

		// Assert
		expect(result2).toBe(true);
	});

	it('Should return TRUE if executable version is invalid', () => {
		// Run
		const result = doesVersionMeetRequirement('a1.7.7', GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe(true);
	});
});

describe('constructIncompatibleGitVersionMessage', () => {
	it('Should return the constructed message', () => {
		// Run
		const result = constructIncompatibleGitVersionMessage({ version: '1.7.7', path: '' }, GitVersionRequirement.TagDetails);

		// Assert
		expect(result).toBe('A newer version of Git (>= 1.7.8) is required for this feature. Git 1.7.7 is currently installed. Please install a newer version of Git to use this feature.');
	});
});

function expectedValueGitGraphUri(filePath: string, commit: string, repo: string, exists: boolean) {
	const extIndex = filePath.indexOf('.', filePath.lastIndexOf('/') + 1);
	const extension = exists && extIndex > -1 ? filePath.substring(extIndex) : '';
	return 'git-graph://file' + extension + '?' + Buffer.from(JSON.stringify({ filePath: filePath, commit: commit, repo: repo, exists: exists })).toString('base64');
}
