const cp = require('child_process');
const fs = require('fs');

const SRC_DIRECTORY = './src/';
const OUT_DIRECTORY = './out/';
const ASKPASS_DIRECTORY = '/askpass';

fs.readdirSync(OUT_DIRECTORY).forEach(filename => {
	if (filename.endsWith('.js')) {
		let script = fs.readFileSync(OUT_DIRECTORY + filename).toString();
		if (script.match(/require\("fs"\)/g)) {
			script = script.replace('"use strict";', '"use strict";\r\nfunction requireWithFallback(electronModule, nodeModule) { try { return require(electronModule); } catch (err) {} return require(nodeModule); }');
			fs.writeFileSync(OUT_DIRECTORY + filename, script.replace(/require\("fs"\)/g, 'requireWithFallback("original-fs", "fs")'));
		}
	}
});

fs.readdirSync(SRC_DIRECTORY + ASKPASS_DIRECTORY).forEach(filename => {
	if (!filename.endsWith('.ts')) {
		fs.writeFileSync(OUT_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename, fs.readFileSync(SRC_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename).toString());
	}
});
