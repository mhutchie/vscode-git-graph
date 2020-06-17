import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/dataSource');
jest.mock('../src/logger');

import * as path from 'path';
import { ConfigurationChangeEvent } from 'vscode';
import { DataSource } from '../src/dataSource';
import { decodeDiffDocUri, DiffDocProvider, DiffSide, encodeDiffDocUri } from '../src/diffDocProvider';
import { EventEmitter } from '../src/event';
import { Logger } from '../src/logger';
import { GitFileStatus } from '../src/types';
import { GitExecutable, UNCOMMITTED } from '../src/utils';

let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<GitExecutable>;
let logger: Logger;
let dataSource: DataSource;

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
	logger = new Logger();
	dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
});

afterAll(() => {
	dataSource.dispose();
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
});

describe('DiffDocProvider', () => {
	it('Should construct a DiffDocProvider, provide a document, and be disposed', async () => {
		// Setup
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);
		jest.spyOn(dataSource, 'getCommitFile').mockResolvedValueOnce('file-contents');

		// Run
		const diffDocProvider = new DiffDocProvider(dataSource);
		const docContents = await diffDocProvider.provideTextDocumentContent(uri);

		// Assert
		expect(docContents).toBe('file-contents');
		expect(diffDocProvider['docs'].size).toBe(1);
		expect(diffDocProvider.onDidChange).toBeTruthy();

		// Run
		diffDocProvider.dispose();

		// Assert
		expect(diffDocProvider['closeDocSubscription'].dispose).toHaveBeenCalled();
		expect(diffDocProvider['docs'].size).toBe(0);
		expect(diffDocProvider['onDidChangeEventEmitter'].dispose).toHaveBeenCalled();
	});

	it('Should remove a cached document once it is closed', async () => {
		// Setup
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);
		jest.spyOn(dataSource, 'getCommitFile').mockResolvedValueOnce('file-contents');

		let closeTextDocument: (doc: { uri: vscode.Uri }) => void;
		vscode.workspace.onDidCloseTextDocument.mockImplementationOnce((callback: (_: { uri: vscode.Uri }) => void) => {
			closeTextDocument = callback;
			return { dispose: jest.fn() };
		});

		// Run
		const diffDocProvider = new DiffDocProvider(dataSource);
		const docContents = await diffDocProvider.provideTextDocumentContent(uri);

		// Assert
		expect(docContents).toBe('file-contents');
		expect(diffDocProvider['docs'].size).toBe(1);

		// Run
		closeTextDocument!({ uri: uri });

		// Assert
		expect(diffDocProvider['docs'].size).toBe(0);

		// Teardown
		diffDocProvider.dispose();
	});

	it('Should reuse a cached document if it exists', async () => {
		// Setup
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);
		const spyOnGetCommitFile = jest.spyOn(dataSource, 'getCommitFile');
		spyOnGetCommitFile.mockResolvedValueOnce('file-contents');

		// Run
		const diffDocProvider = new DiffDocProvider(dataSource);
		const docContents1 = await diffDocProvider.provideTextDocumentContent(uri);
		const docContents2 = await diffDocProvider.provideTextDocumentContent(uri);

		// Assert
		expect(docContents1).toBe('file-contents');
		expect(docContents2).toBe('file-contents');
		expect(spyOnGetCommitFile).toHaveBeenCalledTimes(1);

		// Teardown
		diffDocProvider.dispose();
	});

	it('Should return an empty document if requested', async () => {
		// Setup
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', UNCOMMITTED, GitFileStatus.Deleted, DiffSide.New);

		// Run
		const diffDocProvider = new DiffDocProvider(dataSource);
		const docContents = await diffDocProvider.provideTextDocumentContent(uri);

		// Assert
		expect(docContents).toBe('');

		// Teardown
		diffDocProvider.dispose();
	});

	it('Should display an error message if an error occurred when fetching the file contents from the DataSource, and return an empty document', async () => {
		// Setup
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);
		jest.spyOn(dataSource, 'getCommitFile').mockRejectedValueOnce('error-message');
		vscode.window.showErrorMessage.mockResolvedValue(null);

		// Run
		const diffDocProvider = new DiffDocProvider(dataSource);
		const docContents = await diffDocProvider.provideTextDocumentContent(uri);

		// Assert
		expect(docContents).toBe('');
		expect(vscode.window.showErrorMessage).toBeCalledWith('Unable to retrieve file: error-message');

		// Teardown
		diffDocProvider.dispose();
	});
});

describe('encodeDiffDocUri', () => {
	it('Should return a file URI if requested on uncommitted changes and it is not deleted', () => {
		// Run
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', UNCOMMITTED, GitFileStatus.Added, DiffSide.New);

		// Assert
		expect(uri.scheme).toBe('file');
		expect(uri.fsPath).toBe(path.join('/repo', 'path/to/file.txt'));
	});

	it('Should return an empty file URI if requested on a file displayed on the old side of the diff, and it is added', () => {
		// Run
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Added, DiffSide.Old);

		// Assert
		expect(uri.scheme).toBe('git-graph');
		expect(uri.fsPath).toBe('file');
		expect(uri.query).toBe('bnVsbA==');
	});

	it('Should return an empty file URI if requested on a file displayed on the new side of the diff, and it is deleted', () => {
		// Run
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Deleted, DiffSide.New);

		// Assert
		expect(uri.scheme).toBe('git-graph');
		expect(uri.fsPath).toBe('file');
		expect(uri.query).toBe('bnVsbA==');
	});

	it('Should return a git-graph URI with the provided file extension', () => {
		// Run
		const uri = encodeDiffDocUri('/repo', 'path/to/file.txt', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);

		// Assert
		expect(uri.scheme).toBe('git-graph');
		expect(uri.fsPath).toBe('file.txt');
		expect(uri.query).toBe('eyJmaWxlUGF0aCI6InBhdGgvdG8vZmlsZS50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiIiwicmVwbyI6Ii9yZXBvIn0=');
	});

	it('Should return a git-graph URI with no file extension when it is not provided', () => {
		// Run
		const uri = encodeDiffDocUri('/repo', 'path/to/file', '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', GitFileStatus.Modified, DiffSide.New);

		// Assert
		expect(uri.scheme).toBe('git-graph');
		expect(uri.fsPath).toBe('file');
		expect(uri.query).toBe('eyJmaWxlUGF0aCI6InBhdGgvdG8vZmlsZSIsImNvbW1pdCI6IjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIzYzRkNWU2ZjFhMmIiLCJyZXBvIjoiL3JlcG8ifQ==');
	});
});

describe('decodeDiffDocUri', () => {
	it('Should return an null if requested on an empty file URI', () => {
		// Run
		const value = decodeDiffDocUri(vscode.Uri.file('file').with({
			scheme: 'git-graph',
			query: 'bnVsbA=='
		}));

		// Assert
		expect(value).toBe(null);
	});

	it('Should return the parse DiffDocUriData if requested on a git-graph URI', () => {
		// Run
		const value = decodeDiffDocUri(vscode.Uri.file('file.txt').with({
			scheme: 'git-graph',
			query: 'eyJmaWxlUGF0aCI6InBhdGgvdG8vZmlsZS50eHQiLCJjb21taXQiOiIxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiM2M0ZDVlNmYxYTJiIiwicmVwbyI6Ii9yZXBvIn0='
		}));

		// Assert
		expect(value).toStrictEqual({
			filePath: 'path/to/file.txt',
			commit: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b',
			repo: '/repo'
		});
	});
});
