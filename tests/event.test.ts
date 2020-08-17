import { EventEmitter } from '../src/utils/event';

describe('Event Emitter', () => {
	it('Registers and disposes subscribers', () => {
		// Setup
		const emitter = new EventEmitter<number>();
		const mockSubscriber1 = jest.fn((x: number) => x);
		const mockSubscriber2 = jest.fn((x: number) => x);

		// Run
		emitter.subscribe(mockSubscriber1);
		emitter.subscribe(mockSubscriber2);

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

		// Run
		const disposable = emitter.subscribe(mockSubscriber1);
		emitter.subscribe(mockSubscriber2);
		disposable.dispose();

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

		// Run
		const disposable = emitter.subscribe(mockSubscriber);
		disposable.dispose();
		disposable.dispose();

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

		// Run
		emitter.subscribe(mockSubscriber1);
		emitter.subscribe(mockSubscriber2);
		emitter.emit(5);

		// Assert
		expect(mockSubscriber1).toHaveBeenCalledWith(5);
		expect(mockSubscriber2).toHaveBeenCalledWith(5);

		// Teardown
		emitter.dispose();
	});
});
