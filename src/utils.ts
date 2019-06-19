import { Autolinker } from 'autolinker';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { encodeDiffDocUri } from './diffDocProvider';
import { gitmojis } from './gitmojis.json';
import { GitFileChangeType } from './types';

const htmlEscapes: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#x27;' };
const htmlEscaper = /[&<>"']/g;

const FS_REGEX = /\\/g;

const autolinker = new Autolinker();

export const UNCOMMITTED = '*';

function escapeHtml(str: string) {
	return str.replace(htmlEscaper, (match) => htmlEscapes[match]);
}

export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

export function prepareCommitMesage(commitMessage: string) : string {
	// replace gitmojis
	gitmojis.forEach(function(gitmoji) {
		commitMessage = commitMessage.replace(new RegExp(gitmoji.code, 'gim'), gitmoji.emoji);
	});
	// autolink urls
	commitMessage = escapeHtml(commitMessage);
	if(getConfig().autoLinkUrlsInCommitMessages())
		commitMessage = autolinker.link(commitMessage);
	return commitMessage;
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


// Visual Studio Code Command Wrappers

export function copyToClipboard(text: string) {
	return new Promise<boolean>(resolve => {
		vscode.env.clipboard.writeText(text).then(() => resolve(true), () => resolve(false));
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
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(repo + '/' + newFilePath), options)
				.then(() => resolve(true), () => resolve(false));
		}
	});
}

export function viewScm() {
	return new Promise<boolean>(resolve => {
		vscode.commands.executeCommand('workbench.view.scm').then(() => resolve(true), () => resolve(false));
	});
}

export function runCommandInNewTerminal(cwd: string, command: string, name: string) {
	let terminal = vscode.window.createTerminal({ cwd: cwd, name: name });
	terminal.sendText(command);
	terminal.show();
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