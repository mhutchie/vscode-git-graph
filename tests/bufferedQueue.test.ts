import { BufferedQueue } from '../src/utils/bufferedQueue';

import { waitForExpect } from './helpers/expectations';

describe('BufferedQueue', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	it('Should add items to the queue, and then process them once the buffer has expired', async () => {
		// Setup
		const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
		const queue = new BufferedQueue<string>(onItem, onChanges);

		// Run
		queue.enqueue('a');
		queue.enqueue('b');
		queue.enqueue('c');

		// Assert
		expect(queue['queue']).toStrictEqual(['a', 'b', 'c']);
		expect(queue['processing']).toBe(false);
		expect(clearTimeout).toHaveBeenCalledTimes(2);

		// Run
		jest.runOnlyPendingTimers();
		jest.useRealTimers();

		// Assert
		await waitForExpect(() => expect(queue['processing']).toBe(false));
		expect(onItem).toHaveBeenCalledTimes(3);
		expect(onItem).toHaveBeenCalledWith('a');
		expect(onItem).toHaveBeenCalledWith('b');
		expect(onItem).toHaveBeenCalledWith('c');
		expect(onChanges).toHaveBeenCalledTimes(1);

		// Run
		expect(queue['timeout']).toBe(null);
		queue.dispose();
		expect(queue['timeout']).toBe(null);
	});

	it('Shouldn\'t add duplicate items to the queue', async () => {
		// Setup
		const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
		const queue = new BufferedQueue<string>(onItem, onChanges);

		// Run
		queue.enqueue('a');
		queue.enqueue('b');
		queue.enqueue('c');
		queue.enqueue('a');

		// Assert
		expect(queue['queue']).toStrictEqual(['b', 'c', 'a']);
		expect(queue['processing']).toBe(false);

		// Run
		jest.runOnlyPendingTimers();
		jest.useRealTimers();

		// Assert
		await waitForExpect(() => expect(queue['processing']).toBe(false));
		expect(onItem).toHaveBeenCalledTimes(3);
		expect(onItem).toHaveBeenCalledWith('b');
		expect(onItem).toHaveBeenCalledWith('c');
		expect(onItem).toHaveBeenCalledWith('a');
		expect(onChanges).toHaveBeenCalledTimes(1);
	});

	it('Shouldn\'t call onChanges if not items resulted in a change', async () => {
		// Setup
		const onItem = jest.fn(() => Promise.resolve(false)), onChanges = jest.fn(() => { });
		const queue = new BufferedQueue<string>(onItem, onChanges);

		// Run
		queue.enqueue('a');
		queue.enqueue('b');
		queue.enqueue('c');

		// Assert
		expect(queue['queue']).toStrictEqual(['a', 'b', 'c']);
		expect(queue['processing']).toBe(false);

		// Run
		jest.runOnlyPendingTimers();
		jest.useRealTimers();

		// Assert
		await waitForExpect(() => expect(queue['processing']).toBe(false));
		expect(onItem).toHaveBeenCalledTimes(3);
		expect(onItem).toHaveBeenCalledWith('a');
		expect(onItem).toHaveBeenCalledWith('b');
		expect(onItem).toHaveBeenCalledWith('c');
		expect(onChanges).toHaveBeenCalledTimes(0);
	});

	it('Shouldn\'t trigger a new timeout if the queue is already processing events', () => {
		// Setup
		const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
		const queue = new BufferedQueue<string>(onItem, onChanges);
		queue['processing'] = true;

		// Run
		queue.enqueue('a');
		queue.enqueue('b');
		queue.enqueue('c');

		// Assert
		expect(queue['queue']).toStrictEqual(['a', 'b', 'c']);
		expect(queue['timeout']).toBe(null);
	});

	it('Should clear the timeout when disposed', async () => {
		// Setup
		const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
		const queue = new BufferedQueue<string>(onItem, onChanges);

		// Run
		queue.enqueue('a');
		queue.enqueue('b');
		queue.enqueue('c');

		// Assert
		expect(queue['queue']).toStrictEqual(['a', 'b', 'c']);
		expect(queue['processing']).toBe(false);
		expect(jest.getTimerCount()).toBe(1);

		// Run
		queue.dispose();

		// Assert
		expect(jest.getTimerCount()).toBe(0);
		expect(queue['timeout']).toBe(null);
	});

	describe('bufferDuration', () => {
		it('Should use the default buffer duration of 1000ms', async () => {
			// Setup
			const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
			const queue = new BufferedQueue<string>(onItem, onChanges);

			// Run
			queue.enqueue('a');

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 1000);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(queue['processing']).toBe(false));
			expect(onItem).toHaveBeenCalledTimes(1);
			expect(onItem).toHaveBeenCalledWith('a');
			expect(onChanges).toHaveBeenCalledTimes(1);
		});

		it('Should use the specified buffer duration', async () => {
			// Setup
			const onItem = jest.fn(() => Promise.resolve(true)), onChanges = jest.fn(() => { });
			const queue = new BufferedQueue<string>(onItem, onChanges, 128);

			// Run
			queue.enqueue('a');

			// Assert
			expect(setTimeout).toHaveBeenCalledWith(expect.anything(), 128);

			// Run
			jest.runOnlyPendingTimers();
			jest.useRealTimers();

			// Assert
			await waitForExpect(() => expect(queue['processing']).toBe(false));
			expect(onItem).toHaveBeenCalledTimes(1);
			expect(onItem).toHaveBeenCalledWith('a');
			expect(onChanges).toHaveBeenCalledTimes(1);
		});
	});
});
