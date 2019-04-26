import * as vscode from 'vscode';

const FS_REGEX = /\\/g;

export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

export function copyToClipboard(text: string) {
	return new Promise<boolean>((resolve) => {
		vscode.env.clipboard.writeText(text).then(() => resolve(true), () => resolve(false));
	});
}

export function getPathFromUri(uri: vscode.Uri) {
	return uri.fsPath.replace(FS_REGEX, '/');
}

export function getPathFromStr(str: string) {
	return str.replace(FS_REGEX, '/');
}

// Evaluate promises in parallel, with at most maxParallel running at any time
export function evalPromises<X, Y>(data: X[], maxParallel: number, createPromise: (val: X) => Promise<Y>) {
	return new Promise<Y[]>((resolve, reject) => {
		if (data.length === 1) {
			createPromise(data[0]).then(v => resolve([v])).catch(() => reject());
		} else if (data.length === 0) {
			resolve([]);
		} else {
			let results: Y[] = new Array(data.length), nextPromise = 0, rejected = false, completed = 0;
			function startNext() {
				let cur = nextPromise;
				nextPromise++;
				createPromise(data[cur]).then(result => {
					if (!rejected) {
						results[cur] = result;
						completed++;
						if (nextPromise < data.length) startNext();
						else if (completed === data.length) resolve(results);
					}
				}).catch(() => {
					reject();
					rejected = true;
				});
			}
			for (let i = 0; i < maxParallel && i < data.length; i++) startNext();
		}
	});
}