import * as vscode from 'vscode';

export class Logger {
	private readonly channel: vscode.OutputChannel;

	constructor() {
		this.channel = vscode.window.createOutputChannel('Git Graph');
	}

	public dispose() {
		this.channel.dispose();
	}

	public log(message: string) {
		this.channel.appendLine(timestamp() + message);
	}

	public logCmd(cmd: string, args: string[]) {
		this.channel.appendLine(timestamp() + '> ' + cmd + ' ' + args.join(' ').replace(/--format=[^ ]+/, '--format=...'));
	}

	public logError(message: string) {
		this.channel.appendLine(timestamp() + 'ERROR: ' + message);
	}
}

function timestamp() {
	const date = new Date();
	return '[' + date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds()) + '.' + pad3(date.getMilliseconds()) + '] ';
}

function pad2(i: number) {
	return (i > 9 ? '' : '0') + i;
}

function pad3(i: number) {
	return (i > 99 ? '' : i > 9 ? '0' : '00') + i;
}

export function maskEmail(email: string) {
	return email.substring(0, email.indexOf('@')) + '@*****';
}
