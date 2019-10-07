import * as path from 'path';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { GitFileChangeType } from './types';
import { getPathFromStr, UNCOMMITTED } from './utils';

export const enum DiffSide {
	Old,
	New
}

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
	public static scheme = 'git-graph';
	private readonly dataSource: DataSource;
	private readonly docs = new Map<string, DiffDocument>();
	private readonly closeDocSubscription: vscode.Disposable;

	private onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();

	constructor(dataSource: DataSource) {
		this.dataSource = dataSource;
		this.closeDocSubscription = vscode.workspace.onDidCloseTextDocument((doc) => this.docs.delete(doc.uri.toString()));
	}

	public dispose() {
		this.closeDocSubscription.dispose();
		this.docs.clear();
		this.onDidChangeEventEmitter.dispose();
	}

	get onDidChange() {
		return this.onDidChangeEventEmitter.event;
	}

	public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
		let document = this.docs.get(uri.toString());
		if (document) return document.value;

		let request = decodeDiffDocUri(uri);
		if (request === null) return ''; // Return empty file (used for one side of added / deleted file diff)

		return this.dataSource.getCommitFile(request.repo, request.commit, request.filePath).then(
			(contents) => {
				let document = new DiffDocument(contents);
				this.docs.set(uri.toString(), document);
				return document.value;
			},
			(errorMessage) => {
				vscode.window.showErrorMessage('Unable to retrieve file: ' + errorMessage);
				return '';
			}
		);
	}
}

class DiffDocument {
	private readonly body: string;

	constructor(body: string) {
		this.body = body;
	}

	get value() {
		return this.body;
	}
}


/* Encoding and decoding URI's */

type DiffDocUriData = {
	filePath: string;
	commit: string;
	repo: string;
} | null;

export function encodeDiffDocUri(repo: string, filePath: string, commit: string, type: GitFileChangeType, diffSide: DiffSide): vscode.Uri {
	if (commit === UNCOMMITTED && type !== 'D') {
		return vscode.Uri.file(path.join(repo, filePath));
	}

	let data: DiffDocUriData, extension: string;
	if ((diffSide === DiffSide.Old && type === 'A') || (diffSide === DiffSide.New && type === 'D')) {
		data = null;
		extension = '';
	} else {
		data = {
			filePath: getPathFromStr(filePath),
			commit: commit,
			repo: repo
		};
		let extIndex = data.filePath.indexOf('.', data.filePath.lastIndexOf('/') + 1);
		extension = extIndex > -1 ? data.filePath.substring(extIndex) : '';
	}
	return vscode.Uri.parse(DiffDocProvider.scheme + ':file' + extension).with({query:Buffer.from(JSON.stringify(data)).toString('base64')});
}

export function decodeDiffDocUri(uri: vscode.Uri): DiffDocUriData {
	return JSON.parse(Buffer.from(uri.query, 'base64').toString());
}
