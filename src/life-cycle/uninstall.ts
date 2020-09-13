/**
 * Git Graph generates an event when it is installed, updated, or uninstalled, that is anonymous, non-personal, and cannot be correlated.
 * - Each event only contains the Git Graph and Visual Studio Code version numbers, and a 256 bit cryptographically strong pseudo-random nonce.
 * - The two version numbers recorded in these events only allow aggregate compatibility information to be generated (e.g. 50% of users are 
 *   using Visual Studio Code >= 1.41.0). These insights enable Git Graph to utilise the latest features of Visual Studio Code as soon as
 *   the majority of users are using a compatible version. The data cannot, and will not, be used for any other purpose.
 * - Full details are available at: https://api.mhutchie.com/vscode-git-graph/about
 */

import { LifeCycleStage, generateNonce, getDataDirectory, getLifeCycleStateInDirectory, sendQueue } from './utils';

(async function () {
	try {
		const state = await getLifeCycleStateInDirectory(getDataDirectory());
		if (state !== null) {
			if (state.apiAvailable) {
				state.queue.push({
					stage: LifeCycleStage.Uninstall,
					extension: state.current.extension,
					vscode: state.current.vscode,
					nonce: generateNonce()
				});
				await sendQueue(state.queue);
			}
		}
	} catch (_) { }
})();
