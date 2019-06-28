const fs = require('fs');
const path = require('path');

const OUTPUT_DIRECTORY = './out';
const ASKPASS_DIRECTORY = '/askpass';

if (fs.existsSync(OUTPUT_DIRECTORY)) {
	let outFiles = fs.readdirSync(OUTPUT_DIRECTORY);
	for (let i = 0; i < outFiles.length; i++) {
		if (outFiles[i] !== 'askpass') {
			fs.unlinkSync(path.join(OUTPUT_DIRECTORY, outFiles[i]));
		}
	}

	if (fs.existsSync(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY)) {
		let outFiles = fs.readdirSync(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY);
		for (let i = 0; i < outFiles.length; i++) {
			fs.unlinkSync(path.join(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY, outFiles[i]));
		}
	}
}
