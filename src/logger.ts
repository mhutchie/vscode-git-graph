import * as vscode from 'vscode';
import { Disposable } from './utils/disposable';

const DOUBLE_QUOTE_REGEXP = /"/g;

/**
 * Manages the Git Graph Logger, which writes log information to the Git Graph Output Channel.
 */
export class Logger extends Disposable {
	private readonly channel: vscode.OutputChannel;

	/**
	 * Creates the Git Graph Logger.
	 */
	constructor() {
		super();
		this.channel = vscode.window.createOutputChannel('Git Graph');
		this.registerDisposable(this.channel);
	}

	/**
	 * Log a message to the Output Channel.
	 * @param message The string to be logged.
	 */
	public log(message: string) {
		const date = new Date();
		const timestamp = date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds()) + '.' + pad3(date.getMilliseconds());
		this.channel.appendLine('[' + timestamp + '] ' + message);
	}

	/**
	 * Log the execution of a spawned command to the Output Channel.
	 * @param cmd The command being spawned.
	 * @param args The arguments passed to the command.
	 */
	public logCmd(cmd: string, args: string[]) {
		this.log('> ' + cmd + ' ' + args.map((arg) => arg === ''
			? '""'
			: arg.startsWith('--format=')
				? '--format=...'
				: arg.includes(' ')
					? '"' + arg.replace(DOUBLE_QUOTE_REGEXP, '\\"') + '"'
					: arg
		).join(' '));
	}

	/**
	 * Log an error message to the Output Channel.
	 * @param message The string to be logged.
	 */
	public logError(message: string) {
		this.log('ERROR: ' + message);
	}
}

/**
 * Pad a number with a leading zero if it is less than two digits long.
 * @param n The number to be padded.
 * @returns The padded number.
 */
function pad2(n: number) {
	return (n > 9 ? '' : '0') + n;
}

/**
 * Pad a number with leading zeros if it is less than three digits long.
 * @param n The number to be padded.
 * @returns The padded number.
 */
function pad3(n: number) {
	return (n > 99 ? '' : n > 9 ? '0' : '00') + n;
}
