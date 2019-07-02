const fs = require('fs');
const path = require('path');

const OUTPUT_DIRECTORY = './out';
const ASKPASS_DIRECTORY = '/askpass';

if (fs.existsSync(OUTPUT_DIRECTORY)) {
	fs.readdirSync(OUTPUT_DIRECTORY).forEach(filename => {
		if (filename !== 'askpass') {
			fs.unlinkSync(path.join(OUTPUT_DIRECTORY, filename));
		}
	});

	if (fs.existsSync(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY)) {
		fs.readdirSync(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY).forEach(filename => {
			fs.unlinkSync(path.join(OUTPUT_DIRECTORY + ASKPASS_DIRECTORY, filename));
		});
	}
}
