import * as path from 'path';
import * as vscode from 'vscode';

export class AssetLoader {
	private extensionPath: string;

	constructor(extensionPath: string) {
		this.extensionPath = extensionPath;
	}

	getUri(...pathComps: string[]) {
		return vscode.Uri.file(path.join(this.extensionPath, ...pathComps));
	}
}
