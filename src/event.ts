import * as vscode from 'vscode';

type EventListener<T> = (event: T) => void;

export type Event<T> = (listener: EventListener<T>, disposables: vscode.Disposable[]) => void;

export class EventEmitter<T> implements vscode.Disposable {
	private readonly event: Event<T>;
	private listeners: EventListener<T>[] = [];

	constructor() {
		this.event = (listener: EventListener<T>, disposables: vscode.Disposable[]) => {
			this.listeners.push(listener);
			disposables.push({
				dispose: () => {
					const removeListener = this.listeners.indexOf(listener);
					if (removeListener > -1) {
						this.listeners.splice(removeListener, 1);
					}
				}
			});
		};
	}

	public dispose() {
		this.listeners = [];
	}

	public emit(event: T) {
		this.listeners.forEach((listener) => {
			try {
				listener(event);
			} catch (_) { }
		});
	}

	get subscribe() {
		return this.event;
	}
}
