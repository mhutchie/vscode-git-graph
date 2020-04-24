module.exports = {
	roots: ['./tests'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testRegex: '\\.test\\.ts$',
	moduleFileExtensions: ['ts', 'js'],
	globals: {
		'ts-jest': {
			tsConfig: './tests/tsconfig.json'
		}
	}
};
