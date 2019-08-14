import * as path from 'path';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { DiffSide, GitFileChangeType } from './types';
import { getPathFromStr, UNCOMMITTED } from './utils';

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
	public static scheme = 'git-graph';
	private dataSource: DataSource;
	private onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
	private docs = new Map<string, DiffDocument>();
	private subscriptions: vscode.Disposable;

	constructor(dataSource: DataSource) {
		this.dataSource = dataSource;
		this.subscriptions = vscode.workspace.onDidCloseTextDocument((doc) => this.docs.delete(doc.uri.toString()));
	}

	public dispose() {
		this.subscriptions.dispose();
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
		return this.dataSource.getCommitFile(request.repo, request.commit, request.filePath, request.type, request.diffSide).then(
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
	private body: string;

	constructor(body: string) {
		this.body = body;
	}

	get value() {
		return this.body;
	}
}

export function encodeDiffDocUri(repo: string, filePath: string, commit: string, type: GitFileChangeType, diffSide: DiffSide): vscode.Uri {
	return commit === UNCOMMITTED && type !== 'D'
		? vscode.Uri.file(path.join(repo, filePath))
		: vscode.Uri.parse(DiffDocProvider.scheme + ':' + getPathFromStr(filePath) + '?commit=' + encodeURIComponent(commit) + '&type=' + type + '&diffSide=' + diffSide + '&repo=' + encodeURIComponent(repo));
}

export function decodeDiffDocUri(uri: vscode.Uri) {
	let queryArgs = decodeUriQueryArgs(uri.query);
	return { filePath: uri.path, commit: queryArgs.commit, type: <GitFileChangeType>queryArgs.type, diffSide: <DiffSide>queryArgs.diffSide, repo: queryArgs.repo };
}

function decodeUriQueryArgs(query: string) {
	let queryComps = query.split('&'), queryArgs: { [key: string]: string } = {}, i;
	for (i = 0; i < queryComps.length; i++) {
		let pair = queryComps[i].split('=');
		queryArgs[pair[0]] = decodeURIComponent(pair[1]);
	}
	return queryArgs;
}