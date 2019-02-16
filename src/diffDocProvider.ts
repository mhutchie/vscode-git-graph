import * as vscode from 'vscode';
import { DataSource } from './dataSource';

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
	static scheme = 'git-graph';
	private dataSource: DataSource | null;
	private onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
	private docs = new Map<string, DiffDocument>();
	private subscriptions: vscode.Disposable;

	constructor(dataSource: DataSource | null) {
		this.dataSource = dataSource;
		this.subscriptions = vscode.workspace.onDidCloseTextDocument(doc => this.docs.delete(doc.uri.toString()));
	}

	dispose() {
		this.subscriptions.dispose();
		this.docs.clear();
		this.onDidChangeEventEmitter.dispose();
	}

	get onDidChange() {
		return this.onDidChangeEventEmitter.event;
	}

	public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
		let document = this.docs.get(uri.toString());
		if (document) {
			return document.value;
		}

		let request = decodeDiffDocUri(uri);
        document = new DiffDocument(this.dataSource !== null ? this.dataSource.getFile(request.commit, request.filePath) : '');
        this.docs.set(uri.toString(), document);
        return document.value;
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

export function encodeDiffDocUri(path: string, commit: string): vscode.Uri {
	return vscode.Uri.parse(DiffDocProvider.scheme + ':'+path.replace(/\\/g, '/')+'?'+commit);
}

export function decodeDiffDocUri(uri: vscode.Uri) {
	return {filePath: uri.path, commit:uri.query};
}
