import * as vscode from 'vscode';

export class Disposable implements vscode.Disposable {
	private disposables: vscode.Disposable[] = [];
	private disposed: boolean = false;

	/**
	 * Disposes the resources used by the subclass.
	 */
	public dispose() {
		this.disposed = true;
		this.disposables.forEach((disposable) => {
			try {
				disposable.dispose();
			} catch (_) { }
		});
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

	/**
	 * Is the Disposable disposed.
	 * @returns `TRUE` => Disposable has been disposed, `FALSE` => Disposable hasn't been disposed.
	 */
	protected isDisposed() {
		return this.disposed;
	}
}

export function toDisposable(fn: () => void): vscode.Disposable {
	return {
		dispose: fn
	};
}
