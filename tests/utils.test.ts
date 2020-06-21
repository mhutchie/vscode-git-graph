import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/dataSource');
jest.mock('../src/extensionState');
jest.mock('../src/logger');

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { EventEmitter } from '../src/event';
import { ExtensionState } from '../src/extensionState';
import { Logger } from '../src/logger';
import { GitFileStatus, PullRequestProvider } from '../src/types';
import { abbrevCommit, abbrevText, archive, constructIncompatibleGitVersionMessage, copyFilePathToClipboard, copyToClipboard, createPullRequest, evalPromises, findGit, getGitExecutable, getNonce, getPathFromStr, getPathFromUri, getRelativeTimeDiff, getRepoName, GitExecutable, isGitAtLeastVersion, isPathInWorkspace, openExtensionSettings, openFile, pathWithTrailingSlash, realpath, resolveToSymbolicPath, runGitCommandInNewTerminal, showErrorMessage, showInformationMessage, UNCOMMITTED, viewDiff, viewFileAtRevision, viewScm } from '../src/utils';

let extensionContext = vscode.mocks.extensionContext;
let terminal = vscode.mocks.terminal;
let workspaceConfiguration = vscode.mocks.workspaceConfiguration;
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
});

afterAll(() => {
	dataSource.dispose();
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
	spyOnSpawn = jest.spyOn(cp, 'spawn');
});

type OnCallbacks = { [event: string]: (...args: any[]) => void };

const mockSpyOnSpawn = (callback: (onCallbacks: OnCallbacks, stdoutOnCallbacks: OnCallbacks) => void) => {
	spyOnSpawn.mockImplementationOnce(() => {
		let onCallbacks: OnCallbacks = {}, stdoutOnCallbacks: OnCallbacks = {};
		setTimeout(() => {
			callback(onCallbacks, stdoutOnCallbacks);
		}, 1);
		return {
			on: (event: string, callback: (...args: any[]) => void) => onCallbacks[event] = callback,
			stdout: {
				on: (event: string, callback: (...args: any[]) => void) => stdoutOnCallbacks[event] = callback,
			}
		};
	});
};

const mockSpawnGitVersionSuccessOnce = () => {
	mockSpyOnSpawn((onCallbacks, stdoutOnCallbacks) => {
		stdoutOnCallbacks['data']('git ');
		stdoutOnCallbacks['data']('version 1.2.3');
		onCallbacks['exit'](0);
	});
};

const mockSpawnGitVersionThrowingErrorOnce = () => {
	mockSpyOnSpawn((onCallbacks) => {
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
		jest.spyOn(fs, 'realpath').mockImplementationOnce((path, callback) => callback(null, path as string));

		// Run
		const path = await realpath('\\a\\b');

		// Assert
		expect(path).toBe('/a/b');
	});

	it('Should return the original path if fs.realpath returns an error', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementationOnce((_, callback) => callback(new Error('message'), ''));

		// Run
		const path = await realpath('/a/b');

		// Assert
		expect(path).toBe('/a/b');
	});
});

describe('isPathInWorkspace', () => {
	it('Should return TRUE if a path is a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }, { uri: vscode.Uri.file('/path/to/workspace-folder2') }];

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe(true);
	});

	it('Should return TRUE if a path is within a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }, { uri: vscode.Uri.file('/path/to/workspace-folder2') }];

		// Run
		const result = isPathInWorkspace('/path/to/workspace-folder1/subfolder');

		// Assert
		expect(result).toBe(true);
	});

	it('Should return FALSE if a path is not within a workspace folder', () => {
		// Setup
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }, { uri: vscode.Uri.file('/path/to/workspace-folder2') }];

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
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, path as string));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe('/path/to/workspace-folder1');
	});

	it('Should return the symbolic path if a vscode workspace folder resolves to it', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder1') }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder1');
	});

	it('Should return the original path if it is within a vscode workspace folder', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, path as string));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/workspace-folder1') }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1/subfolder/file.txt');

		// Assert
		expect(result).toBe('/path/to/workspace-folder1/subfolder/file.txt');
	});

	it('Should return the symbolic path if a vscode workspace folder resolves to contain it', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder1') }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder1/subfolder/file.txt');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder1/subfolder/file.txt');
	});

	it('Should return the symbolic path if the vscode workspace folder resolves to be contained within it', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder/dir') }];

		// Run
		const result = await resolveToSymbolicPath('/path/to/workspace-folder');

		// Assert
		expect(result).toBe('/path/to/symbolic-folder');
	});

	it('Should return the original path if the vscode workspace folder resolves to be contained within it, when it was unable to find the path correspondence', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => {
			path = path as string;
			callback(null, path === '/symbolic-folder/path/to/dir' ? path.replace('symbolic', 'workspace') : path);
		});
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/symbolic-folder/path/to/dir') }];

		// Run
		const result = await resolveToSymbolicPath('/workspace-folder/path');

		// Assert
		expect(result).toBe('/workspace-folder/path');
	});

	it('Should return the original path if it is unrelated to the vscode workspace folders', async () => {
		// Setup
		jest.spyOn(fs, 'realpath').mockImplementation((path, callback) => callback(null, (path as string).replace('symbolic', 'workspace')));
		vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/path/to/symbolic-folder/dir') }];

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

describe('abbrevCommit', () => {
	it('Truncates a commit hash to eight characters', () => {
		// Run
		const abbrev = abbrevCommit('1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f');

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
	it('Appends the file path to the repository path, and copies the result to the clipboard', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockResolvedValueOnce(null);

		// Run
		const result = await copyFilePathToClipboard('/a/b', 'c/d.txt');

		// Assert
		const receivedArgs: any[] = vscode.env.clipboard.writeText.mock.calls[0];
		expect(result).toBe(null);
		expect(getPathFromStr(receivedArgs[0])).toBe('/a/b/c/d.txt');
	});

	it('Returns an error message when writeText fails', async () => {
		// Setup
		vscode.env.clipboard.writeText.mockRejectedValueOnce(null);

		// Run
		const result = await copyFilePathToClipboard('/a/b', 'c/d.txt');

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
		vscode.env.openExternal.mockResolvedValueOnce(null);

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
		vscode.env.openExternal.mockResolvedValueOnce(null);

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
		vscode.env.openExternal.mockResolvedValueOnce(null);

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
		vscode.env.openExternal.mockResolvedValueOnce(null);

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
		vscode.env.openExternal.mockResolvedValueOnce(null);

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

describe('openFile', () => {
	it('Should open the file in vscode', async () => {
		// Setup
		jest.spyOn(fs, 'access').mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, number | undefined, (x: NodeJS.ErrnoException | null) => void])[2](null));
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
	});

	it('Should return an error message if vscode was unable to open the file', async () => {
		// Setup
		jest.spyOn(fs, 'access').mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, number | undefined, (x: NodeJS.ErrnoException | null) => void])[2](null));
		vscode.commands.executeCommand.mockRejectedValueOnce(null);

		// Run
		const result = await openFile('/path/to/repo', 'file.txt');

		// Assert
		expect(result).toBe('Visual Studio Code was unable to open file.txt.');
	});

	it('Should return an error message if the file doesn\'t exist in the repository', async () => {
		// Setup
		jest.spyOn(fs, 'access').mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, number | undefined, (x: NodeJS.ErrnoException | null) => void])[2](new Error()));

		// Run
		const result = await openFile('/path/to/repo', 'file.txt');

		// Assert
		expect(result).toBe('The file file.txt doesn\'t currently exist in this repository.');
	});
});

describe('viewDiff', () => {
	it('Should load the vscode diff view (single commit, file added)', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file?bnVsbA==');
		expect(rightUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9hZGRlZC50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYiLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmZeIiwicmVwbyI6Ii9wYXRoL3RvL3JlcG8ifQ==');
		expect(rightUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYiLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9kZWxldGVkLnR4dCIsImNvbW1pdCI6IjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2Zl4iLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
		expect(rightUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file?bnVsbA==');
		expect(rightUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9hZGRlZC50eHQiLCJjb21taXQiOiJhMWIyYzNkNGU1ZjZhMWIyYzNkNGU1ZjZhMWIyYzNkNGU1ZjZhMWIyIiwicmVwbyI6Ii9wYXRoL3RvL3JlcG8ifQ==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYiLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
		expect(rightUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiJhMWIyYzNkNGU1ZjZhMWIyYzNkNGU1ZjZhMWIyYzNkNGU1ZjZhMWIyIiwicmVwbyI6Ii9wYXRoL3RvL3JlcG8ifQ==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9kZWxldGVkLnR4dCIsImNvbW1pdCI6IjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZiIsInJlcG8iOiIvcGF0aC90by9yZXBvIn0=');
		expect(rightUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', UNCOMMITTED, 'subfolder/added.txt', 'subfolder/added.txt', GitFileStatus.Added);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', UNCOMMITTED, 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYiLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', UNCOMMITTED, 'subfolder/deleted.txt', 'subfolder/deleted.txt', GitFileStatus.Deleted);

		// Assert
		const [command, leftUri, rightUri, title, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.diff');
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9kZWxldGVkLnR4dCIsImNvbW1pdCI6IjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZiIsInJlcG8iOiIvcGF0aC90by9yZXBvIn0=');
		expect(rightUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		expect(leftUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9tb2RpZmllZC50eHQiLCJjb21taXQiOiJIRUFEIiwicmVwbyI6Ii9wYXRoL3RvL3JlcG8ifQ==');
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
		expect(leftUri.toString()).toBe('git-graph://file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9kZWxldGVkLnR4dCIsImNvbW1pdCI6IkhFQUQiLCJyZXBvIjoiL3BhdGgvdG8vcmVwbyJ9');
		expect(rightUri.toString()).toBe('git-graph://file?bnVsbA==');
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
		const result = await viewDiff('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/modified.txt', 'subfolder/modified.txt', GitFileStatus.Modified);

		// Assert
		expect(result).toBe('Visual Studio Code was unable load the diff editor for subfolder/modified.txt.');
	});

	it('Should open an untracked file in vscode', async () => {
		// Setup
		jest.spyOn(fs, 'access').mockImplementationOnce((...args) => ((args as unknown) as [fs.PathLike, number | undefined, (x: NodeJS.ErrnoException | null) => void])[2](null));
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
	});
});

describe('viewFileAtRevision', () => {
	it('Should open the file in vscode', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewFileAtRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/file.txt');

		// Assert
		const [command, uri, config] = vscode.commands.executeCommand.mock.calls[0];
		expect(command).toBe('vscode.open');
		expect(uri.toString()).toBe('git-graph://1a2b3c4d: file.txt?eyJmaWxlUGF0aCI6InN1YmZvbGRlci9maWxlLnR4dCIsImNvbW1pdCI6IjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZiIsInJlcG8iOiIvcGF0aC90by9yZXBvIn0=');
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
		const result = await viewFileAtRevision('/path/to/repo', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'subfolder/file.txt');

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

describe('runGitCommandInNewTerminal', () => {
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

	it('Should open a new terminal and run the git command', () => {
		// Setup
		workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue); // integratedTerminalShell

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable:/path/to/git'
			},
			name: 'Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (with initially empty PATH)', () => {
		// Setup
		workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue); // integratedTerminalShell
		process.env.PATH = '';

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/git'
			},
			name: 'Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (with specific shell path)', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce('/path/to/shell'); // integratedTerminalShell

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable:/path/to/git'
			},
			name: 'Name',
			shellPath: '/path/to/shell'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (platform: win32)', () => {
		// Setup
		workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue); // integratedTerminalShell
		Object.defineProperty(process, 'platform', { value: 'win32' });

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (ostype: cygwin)', () => {
		// Setup
		workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue); // integratedTerminalShell
		process.env.OSTYPE = 'cygwin';

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Name'
		});
		expect(terminal.sendText).toHaveBeenCalledWith('git rebase');
		expect(terminal.show).toHaveBeenCalled();
	});

	it('Should open a new terminal and run the git command (ostype: msys)', () => {
		// Setup
		workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue); // integratedTerminalShell
		process.env.OSTYPE = 'msys';

		// Run
		runGitCommandInNewTerminal('/path/to/repo', '/path/to/git/git', 'rebase', 'Name');

		// Assert
		expect(vscode.window.createTerminal).toHaveBeenCalledWith({
			cwd: '/path/to/repo',
			env: {
				PATH: '/path/to/executable;/path/to/git'
			},
			name: 'Name'
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
		workspaceConfiguration.get.mockReturnValueOnce('/path/to/git'); // gitPath
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
		workspaceConfiguration.get.mockReturnValueOnce('/path/to/git'); // gitPath
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
			workspaceConfiguration.get.mockReturnValueOnce(null); // gitPath
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
			workspaceConfiguration.get.mockReturnValueOnce(null); // gitPath
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
			const spyOnStat = jest.spyOn(fs, 'stat');
			spyOnStat.mockImplementation((statPath, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => getPathFromStr(statPath as string) === 'c:/path/to/git-dir/git.exe', isSymbolicLink: () => false } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/git-dir/git.exe');
			expect(result.version).toBe('1.2.3');

			// Teardown
			spyOnStat.mockReset();
		});

		it('Should find Git in PATH (isSymbolicLink)', async () => {
			// Setup
			delete process.env['LocalAppData'];
			process.env['PATH'] = 'c:/path/to/git-dir';
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			const spyOnStat = jest.spyOn(fs, 'stat');
			spyOnStat.mockImplementation((statPath, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => false, isSymbolicLink: () => getPathFromStr(statPath as string) === 'c:/path/to/git-dir/git.exe' } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe('c:/path/to/git-dir/git.exe');
			expect(result.version).toBe('1.2.3');

			// Teardown
			spyOnStat.mockReset();
		});

		it('Should find Git in CWD', async () => {
			// Setup
			delete process.env['PATH'];
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			const spyOnStat = jest.spyOn(fs, 'stat');
			const gitPath = getPathFromStr(path.join(process.cwd(), 'git.exe'));
			spyOnStat.mockImplementation((statPath, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
				callback(null, { isFile: () => getPathFromStr(statPath as string) === gitPath, isSymbolicLink: () => false } as any);
			});
			mockSpawnGitVersionSuccessOnce();

			// Run
			const result = await findGit(extensionState);

			// Assert
			expect(getPathFromStr(result.path)).toBe(gitPath);
			expect(result.version).toBe('1.2.3');

			// Teardown
			spyOnStat.mockReset();
		});

		it('Should reject when Git executable not in PATH', async () => {
			// Setup
			let rejected = false;
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			mockSpawnGitVersionThrowingErrorOnce();
			const spyOnStat = jest.spyOn(fs, 'stat');
			spyOnStat.mockImplementation((_, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void) => {
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
			workspaceConfiguration.get.mockReturnValueOnce(null); // gitPath
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
		mockSpyOnSpawn((onCallbacks) => {
			onCallbacks['exit'](1);
		});

		// Run
		await getGitExecutable('/path/to/git').catch(() => rejected = true);

		// Assert
		expect(rejected).toBe(true);
	});
});

describe('isGitAtLeastVersion', () => {
	it('Should correctly determine major newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6.windows.0', path: '' }, '1.4.6');

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6.windows.0', path: '' }, '3.4.6');

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine minor newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6 (Apple Git-122.3)', path: '' }, '2.3.6');

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine minor older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6 (Apple Git-122.3)', path: '' }, '2.5.6');

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine patch newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.5');

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine patch older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.7');

		// Assert
		expect(result).toBe(false);
	});

	it('Should correctly determine same version', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.6');

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major newer if missing patch version', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4', path: '' }, '1.4');

		// Assert
		expect(result).toBe(true);
	});

	it('Should correctly determine major newer if missing minor & patch versions', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2', path: '' }, '1');

		// Assert
		expect(result).toBe(true);
	});

	it('Should only use the valid portion of the version number to compute the result', () => {
		// Run
		const result1 = isGitAtLeastVersion({ version: '2.4..6-windows.0', path: '' }, '2.4.1');

		// Assert
		expect(result1).toBe(false);

		// Run
		const result2 = isGitAtLeastVersion({ version: '2.4..6-windows.0', path: '' }, '2.4.0');

		// Assert
		expect(result2).toBe(true);
	});

	it('Should return TRUE if executable version is invalid', ()=>{
		// Run
		const result = isGitAtLeastVersion({ version: 'a2.4.6', path: '' }, '1.4.6');

		// Assert
		expect(result).toBe(true);
	});

	it('Should return TRUE if version is invalid', ()=>{
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, 'a1.4.6');

		// Assert
		expect(result).toBe(true);
	});
});

describe('constructIncompatibleGitVersionMessage', () => {
	it('Should return the constructed message', () => {
		// Run
		const result = constructIncompatibleGitVersionMessage({ version: '2.4.5', path: '' }, '3.0.0');

		// Assert
		expect(result).toBe('A newer version of Git (>= 3.0.0) is required for this feature. Git 2.4.5 is currently installed. Please install a newer version of Git to use this feature.');
	});
});
