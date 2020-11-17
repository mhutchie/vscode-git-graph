import * as vscode from 'vscode';

export const commands = {
	executeCommand: jest.fn()
};

export const env = {
	clipboard: {
		writeText: jest.fn()
	},
	openExternal: jest.fn()
};

export const EventEmitter = jest.fn(() => ({
	dispose: jest.fn(),
	event: jest.fn()
}));

export class Uri implements vscode.Uri {
	public readonly scheme: string;
	public readonly authority: string;
	public readonly path: string;
	public readonly query: string;
	public readonly fragment: string;

	protected constructor(scheme: string, authority?: string, path?: string, query?: string, fragment?: string) {
		this.scheme = scheme;
		this.authority = authority || '';
		this.path = path || '';
		this.query = query || '';
		this.fragment = fragment || '';
	}

	get fsPath() {
		return this.path;
	}

	public with(change: { scheme?: string | undefined; authority?: string | undefined; path?: string | undefined; query?: string | undefined; fragment?: string | undefined; }): vscode.Uri {
		return new Uri(change.scheme || this.scheme, change.authority || this.authority, change.path || this.path, change.query || this.query, change.fragment || this.fragment);
	}

	public toString() {
		return this.scheme + '://' + this.path + (this.query ? '?' + this.query : '') + (this.fragment ? '#' + this.fragment : '');
	}

	public toJSON() {
		return this;
	}

	public static file(path: string) {
		return new Uri('file', '', path);
	}

	public static parse(path: string) {
		const comps = path.match(/([a-z]+):\/\/([^?#]+)(\?([^#]+)|())(#(.+)|())/)!;
		return new Uri(comps[1], '', comps[2], comps[4], comps[6]);
	}
}

export enum StatusBarAlignment {
	Left = 1,
	Right = 2
}

export enum ViewColumn {
	Active = -1,
	Beside = -2,
	One = 1,
	Two = 2,
	Three = 3,
	Four = 4,
	Five = 5,
	Six = 6,
	Seven = 7,
	Eight = 8,
	Nine = 9
}

export const window = {
	createOutputChannel: jest.fn(() => mocks.outputChannel),
	createStatusBarItem: jest.fn(() => mocks.statusBarItem),
	createTerminal: jest.fn(() => mocks.terminal),
	showErrorMessage: jest.fn(),
	showInformationMessage: jest.fn(),
	showSaveDialog: jest.fn()
};

export const workspace = {
	createFileSystemWatcher: jest.fn(() => mocks.fileSystemWater),
	getConfiguration: jest.fn(() => mocks.workspaceConfiguration),
	onDidCloseTextDocument: jest.fn((_: () => void) => ({ dispose: jest.fn() })),
	workspaceFolders: <{ uri: Uri }[] | undefined>undefined
};

const mockedExtensionSettingValues: { [section: string]: any } = {};

export const mocks = {
	extensionContext: {
		asAbsolutePath: jest.fn(),
		extensionPath: '/path/to/extension',
		globalState: {
			get: jest.fn(),
			update: jest.fn()
		},
		globalStoragePath: '/path/to/globalStorage',
		logPath: '/path/to/logs',
		storagePath: '/path/to/storage',
		subscriptions: [],
		workspaceState: {
			get: jest.fn(),
			update: jest.fn()
		}
	},
	fileSystemWater: {
		onDidCreate: jest.fn(),
		onDidChange: jest.fn(),
		onDidDelete: jest.fn(),
		dispose: jest.fn()
	},
	outputChannel: {
		appendLine: jest.fn(),
		dispose: jest.fn()
	},
	statusBarItem: {
		text: '',
		tooltip: '',
		command: '',
		show: jest.fn(),
		hide: jest.fn(),
		dispose: jest.fn()
	},
	terminal: {
		sendText: jest.fn(),
		show: jest.fn()
	},
	workspaceConfiguration: {
		get: jest.fn((section: string, defaultValue?: any) => {
			return typeof mockedExtensionSettingValues[section] !== 'undefined'
				? mockedExtensionSettingValues[section]
				: defaultValue;
		}),
		inspect: jest.fn((section: string) => ({
			workspaceValue: mockedExtensionSettingValues[section],
			globalValue: mockedExtensionSettingValues[section]
		}))
	}
};

export function mockExtensionSettingReturnValue(section: string, value: any) {
	mockedExtensionSettingValues[section] = value;
}

export function clearMockedExtensionSettingReturnValues() {
	Object.keys(mockedExtensionSettingValues).forEach((section) => {
		delete mockedExtensionSettingValues[section];
	});
}

export function expectRenamedExtensionSettingToHaveBeenCalled(newSection: string, oldSection: string) {
	expect(mocks.workspaceConfiguration.inspect).toBeCalledWith(newSection);
	expect(mocks.workspaceConfiguration.inspect).toBeCalledWith(oldSection);
}
