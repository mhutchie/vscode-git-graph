import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { standardiseCspSource } from '../src/gitGraphView';

describe('standardiseCspSource', () => {
	it('Should not affect vscode-resource scheme-only sources', () => {
		// Run
		const result = standardiseCspSource('vscode-resource:');

		// Assert
		expect(result).toBe('vscode-resource:');
	});

	it('Should not affect file scheme-only sources', () => {
		// Run
		const result = standardiseCspSource('file:');

		// Assert
		expect(result).toBe('file:');
	});

	it('Should not affect http scheme-only sources', () => {
		// Run
		const result = standardiseCspSource('http:');

		// Assert
		expect(result).toBe('http:');
	});

	it('Should not affect https scheme-only sources', () => {
		// Run
		const result = standardiseCspSource('https:');

		// Assert
		expect(result).toBe('https:');
	});

	it('Should not affect file scheme sources', () => {
		// Run
		const result = standardiseCspSource('file://server');

		// Assert
		expect(result).toBe('file://server');
	});

	it('Should not affect http host-only sources', () => {
		// Run
		const result = standardiseCspSource('http://www.mhutchie.com');

		// Assert
		expect(result).toBe('http://www.mhutchie.com');
	});

	it('Should not affect https host-only sources', () => {
		// Run
		const result = standardiseCspSource('https://www.mhutchie.com');

		// Assert
		expect(result).toBe('https://www.mhutchie.com');
	});

	it('Should not affect https host-only IP sources', () => {
		// Run
		const result = standardiseCspSource('https://192.168.1.101');

		// Assert
		expect(result).toBe('https://192.168.1.101');
	});

	it('Should remove the path component from http sources', () => {
		// Run
		const result = standardiseCspSource('http://www.mhutchie.com/path/to/file');

		// Assert
		expect(result).toBe('http://www.mhutchie.com');
	});

	it('Should remove the path component from https sources', () => {
		// Run
		const result = standardiseCspSource('https://www.mhutchie.com/path/to/file');

		// Assert
		expect(result).toBe('https://www.mhutchie.com');
	});

	it('Should remove the path component from https IP sources', () => {
		// Run
		const result = standardiseCspSource('https://192.168.1.101:8080/path/to/file');

		// Assert
		expect(result).toBe('https://192.168.1.101:8080');
	});

	it('Should remove the query from http/https sources', () => {
		// Run
		const result = standardiseCspSource('https://www.mhutchie.com?query');

		// Assert
		expect(result).toBe('https://www.mhutchie.com');
	});

	it('Should remove the fragment from http/https sources', () => {
		// Run
		const result = standardiseCspSource('https://www.mhutchie.com#fragment');

		// Assert
		expect(result).toBe('https://www.mhutchie.com');
	});

	it('Should remove the path, query & fragment from http/https sources', () => {
		// Run
		const result = standardiseCspSource('https://www.mhutchie.com:443/path/to/file?query#fragment');

		// Assert
		expect(result).toBe('https://www.mhutchie.com:443');
	});
});
