import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { Logger, maskEmail } from '../src/logger';

beforeEach(() => {
	jest.clearAllMocks();
	date.beforeEach();
});

afterEach(() => {
	date.afterEach();
});

describe('Logger', () => {
	it('Should create an output channel, and dispose it on dispose', () => {
		// Run
		const logger = new Logger();

		// Assert
		expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Git Graph');

		// Run
		logger.dispose();

		// Assert
		expect(vscode.OutputChannel.dispose).toBeCalledTimes(1);
	});

	it('Should create an output channel, and dispose it on dispose', () => {
		// Run
		const logger = new Logger();

		// Assert
		expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Git Graph');

		// Run
		logger.dispose();

		// Assert
		expect(vscode.OutputChannel.dispose).toBeCalledTimes(1);
	});

	it('Should log message to the Output Channel', () => {
		// Setup
		const logger = new Logger();

		// Run
		logger.log('Test');

		// Assert
		expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.000] Test');

		// Teardown
		logger.dispose();
	});

	it('Should log command to the Output Channel', () => {
		// Setup
		const logger = new Logger();
		date.setCurrentTime(1587559258.1);

		// Run
		logger.logCmd('git', ['--arg1', '--arg2', '--format="format-string"', '--arg3', 'arg with spaces']);

		// Assert
		expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.100] > git --arg1 --arg2 --format=... --arg3 "arg with spaces"');

		// Teardown
		logger.dispose();
	});

	it('Should log error to the Output Channel', () => {
		// Setup
		const logger = new Logger();
		date.setCurrentTime(1587559258.01);

		// Run
		logger.logError('Test');

		// Assert
		expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith('[2020-04-22 12:40:58.010] ERROR: Test');

		// Teardown
		logger.dispose();
	});
});

describe('maskEmail', () => {
	it('Should mask the domain component of email addresses', () => {
		// Run
		const maskedEmail = maskEmail('test@example.com');

		// Assert
		expect(maskedEmail).toBe('test@*****');
	});
});
