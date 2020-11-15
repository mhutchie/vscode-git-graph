import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { Logger } from '../src/logger';

let outputChannel = vscode.mocks.outputChannel;

beforeEach(() => {
	jest.clearAllMocks();
});

describe('Logger', () => {
	let logger: Logger;
	beforeEach(() => {
		logger = new Logger();
	});
	afterEach(() => {
		logger.dispose();
	});

	it('Should create and dispose an output channel', () => {
		// Run
		logger.dispose();

		// Assert
		expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Git Graph');
		expect(outputChannel.dispose).toBeCalledTimes(1);
	});

	it('Should log a message to the Output Channel', () => {
		// Run
		logger.log('Test');

		// Assert
		expect(outputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.000] Test');
	});

	it('Should log a command to the Output Channel', () => {
		// Setup
		date.setCurrentTime(1587559258.1);

		// Run
		logger.logCmd('git', ['--arg1', '--arg2', '--format="format-string"', '--arg3', 'arg with spaces']);

		// Assert
		expect(outputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.100] > git --arg1 --arg2 --format=... --arg3 "arg with spaces"');
	});

	it('Should log an error to the Output Channel', () => {
		// Setup
		date.setCurrentTime(1587559258.01);

		// Run
		logger.logError('Test');

		// Assert
		expect(outputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.010] ERROR: Test');
	});
});
