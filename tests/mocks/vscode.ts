import * as vscode from 'vscode';

export const commands = {
	executeCommand: jest.fn()
};

export const env = {
	clipboard: {
		writeText: jest.fn()
	}
};

export const Uri = {
	file: jest.fn((path) => ({ fsPath: path } as vscode.Uri))
};

export const ViewColumn = {};

export const OutputChannel = {
	dispose: jest.fn(),
	appendLine: jest.fn()
};

export const window = {
	createOutputChannel: jest.fn(() => OutputChannel),
	showErrorMessage: jest.fn(),
	showInformationMessage: jest.fn()
};
