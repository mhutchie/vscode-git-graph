/*---------------------------------------------------------------------------------------------
 *  This code is based on the askpass implementation in the Microsoft Visual Studio Code Git Extension
 *  https://github.com/microsoft/vscode/blob/473af338e1bd9ad4d9853933da1cd9d5d9e07dc9/extensions/git/src/askpass.ts,
 *  which has the following copyright notice & license:
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See ./src/askpass/LICENSE_MICROSOFT for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from '../utils';

export interface AskpassEnvironment {
	GIT_ASKPASS: string;
	ELECTRON_RUN_AS_NODE?: string;
	VSCODE_GIT_GRAPH_ASKPASS_NODE?: string;
	VSCODE_GIT_GRAPH_ASKPASS_MAIN?: string;
	VSCODE_GIT_GRAPH_ASKPASS_HANDLE?: string;
}

export interface AskpassRequest {
	host: string;
	request: string;
}

export class AskpassManager implements vscode.Disposable {
	private ipcHandlePath: string;
	private server: http.Server;
	private enabled = true;

	constructor() {
		this.ipcHandlePath = getIPCHandlePath(getNonce());
		this.server = http.createServer((req, res) => this.onRequest(req, res));
		try {
			this.server.listen(this.ipcHandlePath);
			this.server.on('error', () => { });
		} catch (err) {
			this.enabled = false;
		}
		fs.chmod(path.join(__dirname, 'askpass.sh'), '755', () => { });
		fs.chmod(path.join(__dirname, 'askpass-empty.sh'), '755', () => { });
	}

	private onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		let reqData = '';
		req.setEncoding('utf8');
		req.on('data', (d) => reqData += d);
		req.on('end', () => {
			let data = JSON.parse(reqData) as AskpassRequest;
			vscode.window.showInputBox({ placeHolder: data.request, prompt: 'Git Graph: ' + data.host, password: /password/i.test(data.request), ignoreFocusOut: true }).then(result => {
				res.writeHead(200);
				res.end(JSON.stringify(result || ''));
			}, () => {
				res.writeHead(500);
				res.end();
			});
		});
	}

	public getEnv(): AskpassEnvironment {
		return this.enabled ?
			{
				ELECTRON_RUN_AS_NODE: '1',
				GIT_ASKPASS: path.join(__dirname, 'askpass.sh'),
				VSCODE_GIT_GRAPH_ASKPASS_NODE: process.execPath,
				VSCODE_GIT_GRAPH_ASKPASS_MAIN: path.join(__dirname, 'askpassMain.js'),
				VSCODE_GIT_GRAPH_ASKPASS_HANDLE: this.ipcHandlePath
			} : {
				GIT_ASKPASS: path.join(__dirname, 'askpass-empty.sh')
			};
	}

	public dispose(): void {
		this.server.close();
		if (process.platform !== 'win32') {
			fs.unlinkSync(this.ipcHandlePath);
		}
	}
}

function getIPCHandlePath(nonce: string): string {
	if (process.platform === 'win32') {
		return '\\\\.\\pipe\\git-graph-askpass-' + nonce + '-sock';
	} else if (process.env['XDG_RUNTIME_DIR']) {
		return path.join(process.env['XDG_RUNTIME_DIR'] as string, 'git-graph-askpass-' + nonce + '.sock');
	} else {
		return path.join(os.tmpdir(), 'git-graph-askpass-' + nonce + '.sock');
	}
}