import * as vscode from 'vscode';

export class Disposable implements vscode.Disposable {
	private disposables: vscode.Disposable[] = [];

	/**
	 * Disposes the resources used by the subclass.
	 */
	public dispose() {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables = [];
	}

	/**
	 * Register a single disposable.
	 */
	protected registerDisposable(disposable: vscode.Disposable) {
		this.disposables.push(disposable);
	}

	/**
	 * Register multiple disposables.
	 */
	protected registerDisposables(...disposables: vscode.Disposable[]) {
		this.disposables.push(...disposables);
	}
}

export function toDisposable(fn: () => void): vscode.Disposable {
	return {
		dispose: fn
	};
}
