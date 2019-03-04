import * as vscode from 'vscode';

export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

export function copyToClipboard(text: string) {
	return new Promise<boolean>((resolve) => {
		vscode.env.clipboard.writeText(text).then(() => resolve(true), () => resolve(false));
	});
}