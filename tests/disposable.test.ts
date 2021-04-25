import * as vscode from 'vscode';
import { Disposable, toDisposable } from '../src/utils/disposable';

class DisposableTest extends Disposable {
	constructor() {
		super();
	}

	public registerDisposable(disposable: vscode.Disposable) {
		super.registerDisposable(disposable);
	}

	public registerDisposables(...disposables: vscode.Disposable[]) {
		super.registerDisposables(...disposables);
	}

	public isDisposed() {
		return super.isDisposed();
	}
}

describe('Disposable', () => {
	it('Should register a disposable', () => {
		// Setup
		const disposableTest = new DisposableTest();
		const disposable = { dispose: jest.fn() };

		// Run
		disposableTest.registerDisposable(disposable);

		// Assert
		expect(disposableTest.isDisposed()).toBe(false);
		expect(disposableTest['disposables']).toStrictEqual([disposable]);
	});

	it('Should register multiple disposables', () => {
		// Setup
		const disposableTest = new DisposableTest();
		const disposable1 = { dispose: jest.fn() };
		const disposable2 = { dispose: jest.fn() };

		// Run
		disposableTest.registerDisposables(disposable1, disposable2);

		// Assert
		expect(disposableTest.isDisposed()).toBe(false);
		expect(disposableTest['disposables']).toStrictEqual([disposable1, disposable2]);
	});

	it('Should dispose all registered disposables', () => {
		// Setup
		const disposableTest = new DisposableTest();
		const disposable1 = { dispose: jest.fn() };
		const disposable2 = { dispose: jest.fn() };
		disposableTest.registerDisposables(disposable1, disposable2);

		// Run
		disposableTest.dispose();

		// Assert
		expect(disposableTest.isDisposed()).toBe(true);
		expect(disposableTest['disposables']).toStrictEqual([]);
		expect(disposable1.dispose).toHaveBeenCalled();
		expect(disposable2.dispose).toHaveBeenCalled();
	});

	it('Should dispose all registered disposables independently, catching any exceptions', () => {
		// Setup
		const disposableTest = new DisposableTest();
		const disposable1 = { dispose: jest.fn() };
		const disposable2 = {
			dispose: jest.fn(() => {
				throw new Error();
			})
		};
		const disposable3 = { dispose: jest.fn() };
		disposableTest.registerDisposables(disposable1, disposable2, disposable3);

		// Run
		disposableTest.dispose();

		// Assert
		expect(disposableTest.isDisposed()).toBe(true);
		expect(disposableTest['disposables']).toStrictEqual([]);
		expect(disposable1.dispose).toHaveBeenCalled();
		expect(disposable2.dispose).toHaveBeenCalled();
		expect(disposable3.dispose).toHaveBeenCalled();
	});
});

describe('toDisposable', () => {
	it('Should wrap a function with a disposable', () => {
		// Setup
		const fn = () => { };

		// Run
		const result = toDisposable(fn);

		// Assert
		expect(result).toStrictEqual({ dispose: fn });
	});
});
