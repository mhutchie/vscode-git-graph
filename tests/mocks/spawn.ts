type OnCallbacks = { [event: string]: (...args: any[]) => void };

export function mockSpyOnSpawn(spyOnSpawn: jest.SpyInstance, callback: (onCallbacks: OnCallbacks, stderrOnCallbacks: OnCallbacks, stdoutOnCallbacks: OnCallbacks) => void) {
	spyOnSpawn.mockImplementationOnce(() => {
		let onCallbacks: OnCallbacks = {}, stderrOnCallbacks: OnCallbacks = {}, stdoutOnCallbacks: OnCallbacks = {};
		setTimeout(() => {
			callback(onCallbacks, stderrOnCallbacks, stdoutOnCallbacks);
		}, 1);
		return {
			on: (event: string, callback: (...args: any[]) => void) => onCallbacks[event] = callback,
			stderr: {
				on: (event: string, callback: (...args: any[]) => void) => stderrOnCallbacks[event] = callback
			},
			stdout: {
				on: (event: string, callback: (...args: any[]) => void) => stdoutOnCallbacks[event] = callback
			}
		};
	});
}
