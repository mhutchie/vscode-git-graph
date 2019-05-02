const fs = require('fs');
const path = require('path');

const OUTPUT_DIRECTORY = './out';

if (fs.existsSync(OUTPUT_DIRECTORY)) {
	let outFiles = fs.readdirSync(OUTPUT_DIRECTORY);
	for (let i = 0; i < outFiles.length; i++) {
		fs.unlinkSync(path.join(OUTPUT_DIRECTORY, outFiles[i]));
	}
}
