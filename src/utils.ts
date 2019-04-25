import * as vscode from 'vscode';

const FS_REGEX = /\\/g;

export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

export function copyToClipboard(text: string) {
	return new Promise<boolean>((resolve) => {
		vscode.env.clipboard.writeText(text).then(() => resolve(true), () => resolve(false));
	});
} 

export function getPathFromUri(uri: vscode.Uri) {
	return uri.fsPath.replace(FS_REGEX, '/');
}

export function getPathFromStr(str: string){
	return str.replace(FS_REGEX, '/');
}