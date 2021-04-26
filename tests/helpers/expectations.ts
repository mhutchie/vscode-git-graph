import { mocks } from '../mocks/vscode';

export function expectRenamedExtensionSettingToHaveBeenCalled(newSection: string, oldSection: string) {
	expect(mocks.workspaceConfiguration.inspect).toBeCalledWith(newSection);
	expect(mocks.workspaceConfiguration.inspect).toBeCalledWith(oldSection);
}

export function waitForExpect(expect: () => void) {
	return new Promise((resolve, reject) => {
		let attempts = 0;
		const testInterval = setInterval(() => {
			try {
				attempts++;
				expect();
				resolve();
			} catch (e) {
				if (attempts === 100) {
					clearInterval(testInterval);
					reject(e);
				}
			}
		}, 20);
	});
}
