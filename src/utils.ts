import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { encodeDiffDocUri } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitCommandError, GitFileChangeType } from './types';

const FS_REGEX = /\\/g;

export const UNCOMMITTED = '*';

export const UNABLE_TO_FIND_GIT_MSG = 'Unable to find a Git executable. Either: Set the Visual Studio Code Setting "git.path" to the path and filename of an existing Git executable, or install Git and restart Visual Studio Code.';

export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

export function getPathFromUri(uri: vscode.Uri) {
	return uri.fsPath.replace(FS_REGEX, '/');
}

export function getPathFromStr(str: string) {
	return str.replace(FS_REGEX, '/');
}

export function isPathInWorkspace(path: string) {
	let rootsExact = [], rootsFolder = [], workspaceFolders = vscode.workspace.workspaceFolders;
	if (typeof workspaceFolders !== 'undefined') {
		for (let i = 0; i < workspaceFolders.length; i++) {
			let tmpPath = getPathFromUri(workspaceFolders[i].uri);
			rootsExact.push(tmpPath);
			rootsFolder.push(tmpPath + '/');
		}
	}
	return rootsExact.indexOf(path) > -1 || rootsFolder.findIndex(x => path.startsWith(x)) > -1;
}

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}


// Visual Studio Code Command Wrappers

export function copyFilePathToClipboard(repo: string, filePath: string) {
	return vscode.env.clipboard.writeText(path.join(repo, filePath)).then(() => true, () => false);
}

export function copyToClipboard(text: string) {
	return vscode.env.clipboard.writeText(text).then(() => true, () => false);
}

export function openFile(repo: string, filePath: string) {
	return new Promise<GitCommandError>(resolve => {
		let p = path.join(repo, filePath);
		fs.exists(p, exists => {
			if (exists) {
				vscode.commands.executeCommand('vscode.open', vscode.Uri.file(p), { preview: true, viewColumn: getConfig().openDiffTabLocation() })
					.then(() => resolve(null), () => resolve('Visual Studio Code was unable to open ' + filePath + '.'));
			} else {
				resolve('The file ' + filePath + ' doesn\'t currently exist in this repository.');
			}
		});
	});
}

export function viewDiff(repo: string, fromHash: string, toHash: string, oldFilePath: string, newFilePath: string, type: GitFileChangeType) {
	return new Promise<boolean>(resolve => {
		let options = { preview: true, viewColumn: getConfig().openDiffTabLocation() };
		if (type !== 'U') {
			let abbrevFromHash = abbrevCommit(fromHash), abbrevToHash = toHash !== UNCOMMITTED ? abbrevCommit(toHash) : 'Present', pathComponents = newFilePath.split('/');
			let desc = fromHash === toHash
				? fromHash === UNCOMMITTED
					? 'Uncommitted'
					: (type === 'A' ? 'Added in ' + abbrevToHash : type === 'D' ? 'Deleted in ' + abbrevToHash : abbrevFromHash + '^ ↔ ' + abbrevToHash)
				: (type === 'A' ? 'Added between ' + abbrevFromHash + ' & ' + abbrevToHash : type === 'D' ? 'Deleted between ' + abbrevFromHash + ' & ' + abbrevToHash : abbrevFromHash + ' ↔ ' + abbrevToHash);
			let title = pathComponents[pathComponents.length - 1] + ' (' + desc + ')';
			if (fromHash === UNCOMMITTED) fromHash = 'HEAD';

			vscode.commands.executeCommand('vscode.diff', encodeDiffDocUri(repo, oldFilePath, fromHash === toHash ? fromHash + '^' : fromHash, type, 'old'), encodeDiffDocUri(repo, newFilePath, toHash, type, 'new'), title, options)
				.then(() => resolve(true), () => resolve(false));
		} else {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(repo, newFilePath)), options)
				.then(() => resolve(true), () => resolve(false));
		}
	});
}

export function viewScm() {
	return new Promise<boolean>(resolve => {
		vscode.commands.executeCommand('workbench.view.scm').then(() => resolve(true), () => resolve(false));
	});
}

export function runGitCommandInNewTerminal(cwd: string, gitPath: string, command: string, name: string) {
	let p = process.env['PATH'] || '', sep = isWindows() ? ';' : ':';
	if (p !== '' && !p.endsWith(sep)) p += sep;
	p += path.dirname(gitPath);

	let options: vscode.TerminalOptions = { cwd: cwd, name: name, env: { 'PATH': p } };
	let shell = getConfig().integratedTerminalShell();
	if (shell !== '') options.shellPath = shell;

	let terminal = vscode.window.createTerminal(options);
	terminal.sendText('git ' + command);
	terminal.show();
}

function isWindows() {
	return process.platform === 'win32' || process.env.OSTYPE === 'cygwin' || process.env.OSTYPE === 'msys';
}

// Evaluate promises in parallel, with at most maxParallel running at any time
export function evalPromises<X, Y>(data: X[], maxParallel: number, createPromise: (val: X) => Promise<Y>) {
	return new Promise<Y[]>((resolve, reject) => {
		if (data.length === 1) {
			createPromise(data[0]).then(v => resolve([v])).catch(() => reject());
		} else if (data.length === 0) {
			resolve([]);
		} else {
			let results: Y[] = new Array(data.length), nextPromise = 0, rejected = false, completed = 0;
			function startNext() {
				let cur = nextPromise;
				nextPromise++;
				createPromise(data[cur]).then(result => {
					if (!rejected) {
						results[cur] = result;
						completed++;
						if (nextPromise < data.length) startNext();
						else if (completed === data.length) resolve(results);
					}
				}).catch(() => {
					reject();
					rejected = true;
				});
			}
			for (let i = 0; i < maxParallel && i < data.length; i++) startNext();
		}
	});
}


/* Find Git Executable */

// The following code matches the behaviour of equivalent functions in Visual Studio Code's Git Extension,
// however was rewritten to meet the needs of this extension.
// The original code has the following copyright notice "Copyright (c) 2015 - present Microsoft Corporation",
// and is licensed under the MIT License provided in ./licenses/LICENSE_MICROSOFT.
// https://github.com/microsoft/vscode/blob/473af338e1bd9ad4d9853933da1cd9d5d9e07dc9/extensions/git/src/git.ts#L44-L135

export interface GitExecutable {
	path: string;
	version: string;
}

export async function findGit(extensionState: ExtensionState) {
	const lastKnownPath = extensionState.getLastKnownGitPath();
	if (lastKnownPath !== null) {
		try {
			return await getGitExecutable(lastKnownPath);
		} catch (_) { }
	}

	const configGitPath = getConfig().gitPath();
	if (configGitPath !== null) {
		try {
			return await getGitExecutable(configGitPath);
		} catch (_) { }
	}

	switch (process.platform) {
		case 'darwin':
			return findGitOnDarwin();
		case 'win32':
			return findGitOnWin32();
		default:
			return getGitExecutable('git');
	}
}

/* Find Git on Darwin */
function findGitOnDarwin() {
	return new Promise<GitExecutable>((resolve, reject) => {
		cp.exec('which git', (err, stdout) => {
			if (err) return reject();

			const path = stdout.trim();
			if (path !== '/usr/bin/git') {
				getGitExecutable(path).then((exec) => resolve(exec), () => reject());
			} else {
				// must check if XCode is installed
				cp.exec('xcode-select -p', (err: any) => {
					if (err && err.code === 2) {
						// git is not installed, and launching /usr/bin/git will prompt the user to install it
						reject();
					} else {
						getGitExecutable(path).then((exec) => resolve(exec), () => reject());
					}
				});
			}
		});
	});
}

/* Find Git on Windows */
function findGitOnWin32() {
	return findSystemGitWin32(process.env['ProgramW6432'])
		.then(undefined, () => findSystemGitWin32(process.env['ProgramFiles(x86)']))
		.then(undefined, () => findSystemGitWin32(process.env['ProgramFiles']))
		.then(undefined, () => findSystemGitWin32(process.env['LocalAppData'] ? path.join(process.env['LocalAppData']!, 'Programs') : undefined))
		.then(undefined, () => findGitWin32InPath());
}
function findSystemGitWin32(pathBase?: string) {
	return pathBase
		? getGitExecutable(path.join(pathBase, 'Git', 'cmd', 'git.exe'))
		: Promise.reject<GitExecutable>();
}
async function findGitWin32InPath() {
	let dirs = (process.env['PATH'] || '').split(';');
	dirs.unshift(process.cwd());

	for (let i = 0; i < dirs.length; i++) {
		let file = path.join(dirs[i], 'git.exe');
		if (await isExecutable(file)) {
			try {
				return await getGitExecutable(file);
			} catch (_) { }
		}
	}
	return Promise.reject<GitExecutable>();
}

/* Find Git Helpers */
function isExecutable(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, (err, stat) => {
			resolve(!err && (stat.isFile() || stat.isSymbolicLink()));
		});
	});
}
export function getGitExecutable(path: string): Promise<GitExecutable> {
	return new Promise<GitExecutable>((resolve, reject) => {
		const cmd = cp.spawn(path, ['--version']);
		let stdout = '';
		cmd.stdout.on('data', (d) => { stdout += d; });
		cmd.on('error', () => reject());
		cmd.on('exit', (code) => {
			if (code) {
				reject();
			} else {
				resolve({ path: path, version: stdout.trim().replace(/^git version /, '') });
			}
		});
	});
}

/* End of Find Git Executable */