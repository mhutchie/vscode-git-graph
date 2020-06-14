import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('../src/logger');

import { ConfigurationChangeEvent } from 'vscode';
import { EventEmitter } from '../src/event';
import { Logger } from '../src/logger';
import { RepoChangeEvent } from '../src/repoManager';
import { StatusBarItem } from '../src/statusBarItem';

let vscodeStatusBarItem = vscode.mocks.statusBarItem;
let workspaceConfiguration = vscode.mocks.workspaceConfiguration;
let onDidChangeRepos: EventEmitter<RepoChangeEvent>;
let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let logger: Logger;

beforeAll(() => {
	onDidChangeRepos = new EventEmitter<RepoChangeEvent>();
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	logger = new Logger();
});

afterAll(() => {
	logger.dispose();
});

beforeEach(() => {
	jest.clearAllMocks();
});

describe('StatusBarItem', () => {
	it('Should show the Status Bar Item on vscode startup', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce(true);

		// Run
		const statusBarItem = new StatusBarItem(1, onDidChangeRepos.subscribe, onDidChangeConfiguration.subscribe, logger);

		// Assert
		expect(vscodeStatusBarItem.text).toBe('Git Graph');
		expect(vscodeStatusBarItem.tooltip).toBe('View Git Graph');
		expect(vscodeStatusBarItem.command).toBe('git-graph.view');
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Teardown
		statusBarItem.dispose();

		// Asset
		expect(vscodeStatusBarItem.dispose).toHaveBeenCalledTimes(1);
	});

	it('Should hide the Status Bar Item after the number of repositories becomes zero', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce(true);

		// Run
		const statusBarItem = new StatusBarItem(1, onDidChangeRepos.subscribe, onDidChangeConfiguration.subscribe, logger);

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Run
		onDidChangeRepos.emit({
			repos: {},
			numRepos: 0,
			loadRepo: null
		});

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(1);

		// Teardown
		statusBarItem.dispose();
	});

	it('Should show the Status Bar Item after the number of repositories increases above zero', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce(true);
		workspaceConfiguration.get.mockReturnValueOnce(true);

		// Run
		const statusBarItem = new StatusBarItem(0, onDidChangeRepos.subscribe, onDidChangeConfiguration.subscribe, logger);

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(0);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Run
		onDidChangeRepos.emit({
			repos: {},
			numRepos: 1,
			loadRepo: null
		});

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Teardown
		statusBarItem.dispose();
	});

	it('Should hide the Status Bar Item the extension setting git-graph.showStatusBarItem becomes disabled', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce(true);
		workspaceConfiguration.get.mockReturnValueOnce(false);

		// Run
		const statusBarItem = new StatusBarItem(1, onDidChangeRepos.subscribe, onDidChangeConfiguration.subscribe, logger);

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Run
		onDidChangeConfiguration.emit({
			affectsConfiguration: () => true
		});

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(1);

		// Teardown
		statusBarItem.dispose();
	});

	it('Should ignore extension setting changes unrelated to git-graph.showStatusBarItem', () => {
		// Setup
		workspaceConfiguration.get.mockReturnValueOnce(true);
		workspaceConfiguration.get.mockReturnValueOnce(false);

		// Run
		const statusBarItem = new StatusBarItem(1, onDidChangeRepos.subscribe, onDidChangeConfiguration.subscribe, logger);

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Run
		onDidChangeConfiguration.emit({
			affectsConfiguration: () => false
		});

		// Assert
		expect(vscodeStatusBarItem.show).toHaveBeenCalledTimes(1);
		expect(vscodeStatusBarItem.hide).toHaveBeenCalledTimes(0);

		// Teardown
		statusBarItem.dispose();
	});
});
