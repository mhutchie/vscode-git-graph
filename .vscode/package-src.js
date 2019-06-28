const cp = require('child_process');
const fs = require('fs');

const SRC_DIRECTORY = './src/';
const OUT_DIRECTORY = './out/';

let askpassFiles = fs.readdirSync(SRC_DIRECTORY + '/askpass');
for (let i = 0; i < askpassFiles.length; i++) {
	if (!askpassFiles[i].endsWith('.ts')) {
		fs.writeFileSync(OUT_DIRECTORY + '/askpass/' + askpassFiles[i], fs.readFileSync(SRC_DIRECTORY + '/askpass/' + askpassFiles[i]).toString());
	}
}