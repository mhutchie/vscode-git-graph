const cp = require('child_process');
const fs = require('fs');

const SRC_DIRECTORY = './src/';
const OUT_DIRECTORY = './out/';
const ASKPASS_DIRECTORY = '/askpass';

fs.readdirSync(SRC_DIRECTORY + ASKPASS_DIRECTORY).forEach(filename => {
	if (!filename.endsWith('.ts')) {
		fs.writeFileSync(OUT_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename, fs.readFileSync(SRC_DIRECTORY + ASKPASS_DIRECTORY + '/' + filename).toString());
	}
});
