/**
 * Git Graph generates an event when it is installed, updated, or uninstalled, that is anonymous, non-personal, and cannot be correlated.
 * - Each event only contains the Git Graph and Visual Studio Code version numbers, and a 256 bit cryptographically strong pseudo-random nonce.
 * - The two version numbers recorded in these events only allow aggregate compatibility information to be generated (e.g. 50% of users are
 *   using Visual Studio Code >= 1.41.0). These insights enable Git Graph to utilise the latest features of Visual Studio Code as soon as
 *   the majority of users are using a compatible version. The data cannot, and will not, be used for any other purpose.
 * - Full details are available at: https://api.mhutchie.com/vscode-git-graph/about
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

type LifeCycleEvent = {
	stage: LifeCycleStage.Install;
	extension: string;
	vscode: string;
	nonce: string;
} | {
	stage: LifeCycleStage.Update;
	from: {
		extension: string,
		vscode: string
	};
	to: {
		extension: string,
		vscode: string
	};
	nonce: string;
} | {
	stage: LifeCycleStage.Uninstall;
	extension: string;
	vscode: string;
	nonce: string;
};

export enum LifeCycleStage {
	Install,
	Update,
	Uninstall
}

export interface LifeCycleState {
	previous: {
		extension: string,
		vscode: string,
	} | null;
	current: {
		extension: string,
		vscode: string
	};
	apiAvailable: boolean;
	queue: LifeCycleEvent[];
	attempts: number;
}

/**
 * Generate a 256 bit cryptographically strong pseudo-random nonce.
 * @returns The nonce.
 */
export function generateNonce() {
	return crypto.randomBytes(32).toString('base64');
}

/**
 * Gets the data directory for files used by the life cycle process.
 * @returns The path of the directory.
 */
export function getDataDirectory() {
	return path.join(__dirname, 'data');
}

/**
 * Gets the path of the life cycle file in the specified directory.
 * @param directory The path of the directory.
 * @returns The path of the life cycle file.
 */
function getLifeCycleFilePathInDirectory(directory: string) {
	return path.join(directory, 'life-cycle.json');
}

/**
 * Gets the life cycle state of Git Graph from the specified directory.
 * @param directory The directory that contains the life cycle state.
 * @returns The life cycle state.
 */
export function getLifeCycleStateInDirectory(directory: string) {
	return new Promise<LifeCycleState | null>((resolve) => {
		fs.readFile(getLifeCycleFilePathInDirectory(directory), (err, data) => {
			if (err) {
				resolve(null);
			} else {
				try {
					resolve(Object.assign({ attempts: 1 }, JSON.parse(data.toString())));
				} catch (_) {
					resolve(null);
				}
			}
		});
	});
}

/**
 * Saves the life cycle state of Git Graph in the specified directory.
 * @param directory The directory to store the life cycle state.
 * @param state The state to save.
 */
export function saveLifeCycleStateInDirectory(directory: string, state: LifeCycleState) {
	return new Promise<void>((resolve, reject) => {
		fs.mkdir(directory, (err) => {
			if (!err || err.code === 'EEXIST') {
				fs.writeFile(getLifeCycleFilePathInDirectory(directory), JSON.stringify(state), (err) => {
					if (err) {
						reject();
					} else {
						resolve();
					}
				});
			} else {
				reject();
			}
		});
	});
}

/**
 * Send all events in a specified queue of life cycle events (typically only one event long).
 * @param queue The queue containing the events.
 * @returns TRUE => Queue was successfully sent & the API is still available, FALSE => The API is no longer available.
 */
export async function sendQueue(queue: LifeCycleEvent[]) {
	for (let i = 0; i < queue.length; i++) {
		if (!await sendEvent(queue[i])) return false;
	}
	return true;
}

/**
 * Send an event to the API.
 * @param event The event to send.
 * @returns TRUE => Event was successfully sent & the API is still available, FALSE => The API is no longer available.
 */
function sendEvent(event: LifeCycleEvent) {
	return new Promise<boolean>((resolve, reject) => {
		let completed = false, receivedResponse = false, apiAvailable = false;
		const complete = () => {
			if (!completed) {
				completed = true;
				if (receivedResponse) {
					resolve(apiAvailable);
				} else {
					reject();
				}
			}
		};

		const sendEvent: Omit<LifeCycleEvent, 'stage'> & { about: string, stage?: LifeCycleStage } = Object.assign({
			about: 'Information about this API is available at: https://api.mhutchie.com/vscode-git-graph/about'
		}, event);
		delete sendEvent.stage;

		const content = JSON.stringify(sendEvent);
		https.request({
			method: 'POST',
			hostname: 'api.mhutchie.com',
			path: '/vscode-git-graph/' + (event.stage === LifeCycleStage.Install ? 'install' : event.stage === LifeCycleStage.Update ? 'update' : 'uninstall'),
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': content.length
			},
			agent: false,
			timeout: 15000
		}, (res) => {
			res.on('data', () => { });
			res.on('end', () => {
				if (res.statusCode === 201) {
					receivedResponse = true;
					apiAvailable = true;
				} else if (res.statusCode === 410) {
					receivedResponse = true;
				}
				complete();
			});
			res.on('error', complete);
		}).on('error', complete).on('close', complete).end(content);
	});
}
