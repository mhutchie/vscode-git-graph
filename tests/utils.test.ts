import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { abbrevCommit, abbrevText, constructIncompatibleGitVersionMessage, copyFilePathToClipboard, copyToClipboard, getNonce, getPathFromStr, getPathFromUri, getRelativeTimeDiff, getRepoName, isGitAtLeastVersion, openExtensionSettings, pathWithTrailingSlash, showErrorMessage, showInformationMessage, viewScm } from '../src/utils';

beforeEach(() => {
	jest.clearAllMocks();
	date.beforeEach();
});

afterEach(() => {
	date.afterEach();
});

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

describe('abbrevCommit', () => {
	it('Truncates a commit hash to eight characters', () => {
		// Run
		const abbrev = abbrevCommit('70b7e1f4ff418f7ae790005ee5315bba50c16d9c');

		// Assert
		expect(abbrev).toBe('70b7e1f4');
	});

	it('Doesn\'t truncate commit hashes less than eight characters', () => {
		// Run
		const abbrev = abbrevCommit('70b7e1');

		// Assert
		expect(abbrev).toBe('70b7e1');
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

describe('openExtensionSettings', () => {
	it('Executes workbench.action.openSettings', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await openExtensionSettings();

		// Assert
		const receivedArgs: any[] = vscode.commands.executeCommand.mock.calls[0];
		expect(result).toBe(null);
		expect(receivedArgs[0]).toBe('workbench.action.openSettings');
		expect(receivedArgs[1]).toBe('@ext:mhutchie.git-graph');
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

describe('viewScm', () => {
	it('Executes workbench.view.scm', async () => {
		// Setup
		vscode.commands.executeCommand.mockResolvedValueOnce(null);

		// Run
		const result = await viewScm();

		// Assert
		const receivedArgs: any[] = vscode.commands.executeCommand.mock.calls[0];
		expect(result).toBe(null);
		expect(receivedArgs[0]).toBe('workbench.view.scm');
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

describe('isGitAtLeastVersion', () => {
	it('Should correctly determine major newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '1.4.6');

		// Assert
		expect(result).toBeTruthy();
	});

	it('Should correctly determine major older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '3.4.6');

		// Assert
		expect(result).toBeFalsy();
	});

	it('Should correctly determine minor newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.3.6');

		// Assert
		expect(result).toBeTruthy();
	});

	it('Should correctly determine minor older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.5.6');

		// Assert
		expect(result).toBeFalsy();
	});

	it('Should correctly determine patch newer', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.5');

		// Assert
		expect(result).toBeTruthy();
	});

	it('Should correctly determine patch older', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.7');

		// Assert
		expect(result).toBeFalsy();
	});

	it('Should correctly determine same version', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4.6', path: '' }, '2.4.6');

		// Assert
		expect(result).toBeTruthy();
	});

	it('Should correctly determine major newer if missing patch version', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2.4', path: '' }, '1.4');

		// Assert
		expect(result).toBeTruthy();
	});

	it('Should correctly determine major newer if missing minor & patch versions', () => {
		// Run
		const result = isGitAtLeastVersion({ version: '2', path: '' }, '1');

		// Assert
		expect(result).toBeTruthy();
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
