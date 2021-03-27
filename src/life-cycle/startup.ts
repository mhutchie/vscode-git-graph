/**
 * Git Graph generates an event when it is installed, updated, or uninstalled, that is anonymous, non-personal, and cannot be correlated.
 * - Each event only contains the Git Graph and Visual Studio Code version numbers, and a 256 bit cryptographically strong pseudo-random nonce.
 * - The two version numbers recorded in these events only allow aggregate compatibility information to be generated (e.g. 50% of users are
 *   using Visual Studio Code >= 1.41.0). These insights enable Git Graph to utilise the latest features of Visual Studio Code as soon as
 *   the majority of users are using a compatible version. The data cannot, and will not, be used for any other purpose.
 * - Full details are available at: https://api.mhutchie.com/vscode-git-graph/about
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LifeCycleStage, LifeCycleState, generateNonce, getDataDirectory, getLifeCycleStateInDirectory, saveLifeCycleStateInDirectory, sendQueue } from './utils';
import { getExtensionVersion } from '../utils';

/**
 * Run on startup to detect if Git Graph has been installed or updated, and if so generate an event.
 * @param extensionContext The extension context of Git Graph.
 */
export async function onStartUp(extensionContext: vscode.ExtensionContext) {
	if (vscode.env.sessionId === 'someValue.sessionId') {
		// Extension is running in the Extension Development Host, don't proceed.
		return;
	}

	let state = await getLifeCycleStateInDirectory(extensionContext.globalStoragePath);

	if (state !== null && !state.apiAvailable) {
		// The API is no longer available, don't proceed.
		return;
	}

	const versions = {
		extension: await getExtensionVersion(extensionContext),
		vscode: vscode.version
	};

	if (state === null || state.current.extension !== versions.extension) {
		// This is the first startup after installing Git Graph, or Git Graph has been updated since the last startup.
		const nonce = await getNonce();

		if (state === null) {
			// Install
			state = {
				previous: null,
				current: versions,
				apiAvailable: true,
				queue: [{
					stage: LifeCycleStage.Install,
					extension: versions.extension,
					vscode: versions.vscode,
					nonce: nonce
				}],
				attempts: 1
			};
		} else {
			// Update
			state.previous = state.current;
			state.current = versions;
			state.queue.push({
				stage: LifeCycleStage.Update,
				from: state.previous,
				to: state.current,
				nonce: nonce
			});
			state.attempts = 1;
		}

		await saveLifeCycleState(extensionContext, state);
		state.apiAvailable = await sendQueue(state.queue);
		state.queue = [];
		await saveLifeCycleState(extensionContext, state);

	} else if (state.queue.length > 0 && state.attempts < 2) {
		// There are one or more events in the queue that previously failed to send, send them
		state.attempts++;
		await saveLifeCycleState(extensionContext, state);
		state.apiAvailable = await sendQueue(state.queue);
		state.queue = [];
		await saveLifeCycleState(extensionContext, state);
	}
}

/**
 * Saves the life cycle state to the extensions global storage directory (for use during future updates),
 * and to a directory in this Git Graph installation (for use during future uninstalls).
 * @param extensionContext The extension context of Git Graph.
 * @param state The state to save.
 */
function saveLifeCycleState(extensionContext: vscode.ExtensionContext, state: LifeCycleState) {
	return Promise.all([
		saveLifeCycleStateInDirectory(extensionContext.globalStoragePath, state),
		saveLifeCycleStateInDirectory(getDataDirectory(), state)
	]);
}

/**
 * Get a nonce generated for this installation of Git Graph.
 * @returns A 256 bit cryptographically strong pseudo-random nonce.
 */
function getNonce() {
	return new Promise<string>((resolve, reject) => {
		const dir = getDataDirectory();
		const file = path.join(dir, 'lock.json');
		fs.mkdir(dir, (err) => {
			if (err) {
				if (err.code === 'EEXIST') {
					// The directory already exists, attempt to read the previously created data
					fs.readFile(file, (err, data) => {
						if (err) {
							// Unable to read the file, reject
							reject();
						} else {
							try {
								// Resolve to the previously generated nonce
								resolve(JSON.parse(data.toString()).nonce);
							} catch (_) {
								reject();
							}
						}
					});
				} else {
					// An unexpected error occurred, reject
					reject();
				}
			} else {
				// The directory was created, generate a nonce
				const nonce = generateNonce();
				fs.writeFile(file, JSON.stringify({ nonce: nonce }), (err) => {
					if (err) {
						// Unable to save data
						reject();
					} else {
						// Nonce successfully saved, resolve to it
						resolve(nonce);
					}
				});
			}
		});
	});
}
