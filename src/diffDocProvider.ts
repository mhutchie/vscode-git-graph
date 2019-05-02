import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { getPathFromStr } from './utils';

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
	public static scheme = 'git-graph';
	private dataSource: DataSource;
	private onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
	private docs = new Map<string, DiffDocument>();
	private subscriptions: vscode.Disposable;

	constructor(dataSource: DataSource) {
		this.dataSource = dataSource;
		this.subscriptions = vscode.workspace.onDidCloseTextDocument(doc => this.docs.delete(doc.uri.toString()));
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
		return this.dataSource.getCommitFile(request.repo, request.commit, request.filePath).then((data) => {
			let document = new DiffDocument(data);
			this.docs.set(uri.toString(), document);
			return document.value;
		});
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

export function encodeDiffDocUri(repo: string, path: string, commit: string): vscode.Uri {
	return vscode.Uri.parse(DiffDocProvider.scheme + ':' + getPathFromStr(path) + '?commit=' + encodeURIComponent(commit) + '&repo=' + encodeURIComponent(repo));
}

export function decodeDiffDocUri(uri: vscode.Uri) {
	let queryArgs = decodeUriQueryArgs(uri.query);
	return { filePath: uri.path, commit: queryArgs.commit, repo: queryArgs.repo };
}

function decodeUriQueryArgs(query: string) {
	let queryComps = query.split('&'), queryArgs: { [key: string]: string } = {}, i;
	for (i = 0; i < queryComps.length; i++) {
		let pair = queryComps[i].split('=');
		queryArgs[pair[0]] = decodeURIComponent(pair[1]);
	}
	return queryArgs;
}