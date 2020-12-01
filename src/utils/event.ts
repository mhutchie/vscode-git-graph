import * as vscode from 'vscode';

/**
 * A function used by a subscriber to process an event emitted from an EventEmitter.
 */
type EventListener<T> = (event: T) => void;

/**
 * A function used to subscribe to an EventEmitter.
 */
export type Event<T> = (listener: EventListener<T>) => vscode.Disposable;

/**
 * Represents an EventEmitter, which is used to automate the delivery of events to subscribers. This applies the observer pattern.
 */
export class EventEmitter<T> implements vscode.Disposable {
	private readonly event: Event<T>;
	private listeners: EventListener<T>[] = [];

	/**
	 * Creates an EventEmitter.
	 */
	constructor() {
		this.event = (listener: EventListener<T>) => {
			this.listeners.push(listener);
			return {
				dispose: () => {
					const removeListener = this.listeners.indexOf(listener);
					if (removeListener > -1) {
						this.listeners.splice(removeListener, 1);
					}
				}
			};
		};
	}

	/**
	 * Disposes the resources used by the EventEmitter.
	 */
	public dispose() {
		this.listeners = [];
	}

	/**
	 * Emit an event to all subscribers of the EventEmitter.
	 * @param event The event to emit.
	 */
	public emit(event: T) {
		this.listeners.forEach((listener) => {
			try {
				listener(event);
			} catch (_) { }
		});
	}

	/**
	 * Does the EventEmitter have any registered listeners.
	 * @returns TRUE => There are one or more registered subscribers, FALSE => There are no registered subscribers
	 */
	public hasSubscribers() {
		return this.listeners.length > 0;
	}

	/**
	 * Get the Event of this EventEmitter, which can be used to subscribe to the emitted events.
	 * @returns The Event.
	 */
	get subscribe() {
		return this.event;
	}
}
