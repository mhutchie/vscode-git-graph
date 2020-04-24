import * as vscode from 'vscode';
import { EventEmitter } from '../src/event';

describe('Event Emitter', () => {
	it('Registers and disposes subscribers', () => {
		// Setup
		const emitter = new EventEmitter<number>();
		const mockSubscriber1 = jest.fn((x: number) => x);
		const mockSubscriber2 = jest.fn((x: number) => x);
		const disposables: vscode.Disposable[] = [];

		// Run
		emitter.subscribe(mockSubscriber1, disposables);
		emitter.subscribe(mockSubscriber2, disposables);

		// Assert
		expect(emitter['listeners'].length).toBe(2);

		// Run
		emitter.dispose();

		// Assert
		expect(emitter['listeners'].length).toBe(0);
	});

	it('Disposes a specific subscriber', () => {
		// Setup
		const emitter = new EventEmitter<number>();
		const mockSubscriber1 = jest.fn((x: number) => x);
		const mockSubscriber2 = jest.fn((x: number) => x);
		const disposables1: vscode.Disposable[] = [];
		const disposables2: vscode.Disposable[] = [];

		// Run
		emitter.subscribe(mockSubscriber1, disposables1);
		emitter.subscribe(mockSubscriber2, disposables2);
		disposables1.forEach((disposable) => disposable.dispose());

		// Assert
		expect(emitter['listeners'].length).toBe(1);
		expect(emitter['listeners'][0]).toBe(mockSubscriber2);

		// Teardown
		emitter.dispose();
	});

	it('Handles duplicate disposes of a specific subscriber', () => {
		// Setup
		const emitter = new EventEmitter<number>();
		const mockSubscriber = jest.fn((x: number) => x);
		const disposables: vscode.Disposable[] = [];

		// Run
		emitter.subscribe(mockSubscriber, disposables);
		disposables.forEach((disposable) => disposable.dispose());
		disposables.forEach((disposable) => disposable.dispose());

		// Assert
		expect(emitter['listeners'].length).toBe(0);

		// Teardown
		emitter.dispose();
	});

	it('Calls subscribers when an event is emitted', () => {
		// Setup
		const emitter = new EventEmitter<number>();
		const mockSubscriber1 = jest.fn((x: number) => x);
		const mockSubscriber2 = jest.fn((x: number) => x);
		const disposables: vscode.Disposable[] = [];

		// Run
		emitter.subscribe(mockSubscriber1, disposables);
		emitter.subscribe(mockSubscriber2, disposables);
		emitter.emit(5);

		// Assert
		expect(mockSubscriber1.mock.calls.length).toBe(1);
		expect(mockSubscriber1.mock.calls[0][0]).toBe(5);
		expect(mockSubscriber2.mock.calls.length).toBe(1);
		expect(mockSubscriber2.mock.calls[0][0]).toBe(5);

		// Teardown
		emitter.dispose();
	});
});
