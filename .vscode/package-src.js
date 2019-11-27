const cp = require('child_process');
const fs = require('fs');

const SRC_DIRECTORY = './src/';
const OUT_DIRECTORY = './out/';
const ASKPASS_DIRECTORY = '/askpass';

fs.readdirSync(OUT_DIRECTORY).forEach(filename => {
	if (filename.endsWith('.js')) {
		const scriptFilePath = OUT_DIRECTORY + filename;
		const mapFilePath = scriptFilePath + '.map';

		let script = fs.readFileSync(scriptFilePath).toString();
		if (script.match(/require\("fs"\)/g)) {
			// If the script requires the Node.js File System Module, adjust the require call to use the Node.js version (as Electron overrides the fs module with its own version of the module)
			script = script.replace('"use strict";', '"use strict";\r\nfunction requireWithFallback(electronModule, nodeModule) { try { return require(electronModule); } catch (err) {} return require(nodeModule); }');
			fs.writeFileSync(scriptFilePath, script.replace(/require\("fs"\)/g, 'requireWithFallback("original-fs", "fs")'));

			// Adjust the mapping file, as we added requireWithFallback on a new line at the start of the file.
			let data = JSON.parse(fs.readFileSync(mapFilePath).toString());
			data.mappings = ';' + data.mappings;
			fs.writeFileSync(mapFilePath, JSON.stringify(data));
		}
	}
});

fs.readdirSync(SRC_DIRECTORY + ASKPASS_DIRECTORY).forEach(filename => {
	if (!filename.endsWith('.ts')) {
		fs.writeFileSync(OUT_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename, fs.readFileSync(SRC_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename).toString());
	}
});
