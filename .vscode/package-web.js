const cp = require('child_process');
const fs = require('fs');

const MEDIA_DIRECTORY = './media/';
const MAIN_FILE = 'main.js';
const UTILS_FILE = 'utils.js';
const OUTPUT_TMP_FILE = 'out.tmp.js';
const OUTPUT_MIN_FILE = 'out.min.js';
const DEBUG = process.argv.length > 2 && process.argv[2] === 'debug';


// Determine the files to be packaged. The order is: utils.ts, *.ts, and then main.ts
let packageFiles = [MEDIA_DIRECTORY + UTILS_FILE];
let mediaFiles = fs.readdirSync(MEDIA_DIRECTORY);
for (let i = 0; i < mediaFiles.length; i++) {
	if (mediaFiles[i].endsWith('.js') && mediaFiles[i] !== OUTPUT_MIN_FILE && mediaFiles[i] !== UTILS_FILE && mediaFiles[i] !== MAIN_FILE) packageFiles.push(MEDIA_DIRECTORY + mediaFiles[i]);
}
packageFiles.push(MEDIA_DIRECTORY + MAIN_FILE);


// Log packaging information
console.log('Packaging files: ' + packageFiles.join(', '));
if (DEBUG) console.log('Debug Mode = ON');


// Combine the files into an IIFE, with a single "use strict" directive
let fileContents = '';
for (let i = 0; i < packageFiles.length; i++) {
	fileContents += fs.readFileSync(packageFiles[i]).toString().replace('"use strict";\r\n', '') + '\r\n';
	fs.unlinkSync(packageFiles[i])
}
fs.writeFileSync(MEDIA_DIRECTORY + OUTPUT_TMP_FILE, '"use strict";\r\n(function(document, window){\r\n' + fileContents + '})(document, window);\r\n');


// Run uglifyjs with the required arguments
cp.exec('uglifyjs ' + MEDIA_DIRECTORY + OUTPUT_TMP_FILE + ' ' + (DEBUG ? '-b' : '--mangle') + ' --output ' + MEDIA_DIRECTORY + OUTPUT_MIN_FILE, (err, stdout, stderr) => {
	if (err) {
		console.log('ERROR:');
		console.log(err);
		process.exit(1);
	} else if (stderr) {
		console.log('ERROR:');
		console.log(stderr);
		process.exit(1);
	} else {
		console.log('');
		if (stdout !== '') console.log(stdout);
		fs.unlinkSync(MEDIA_DIRECTORY + OUTPUT_TMP_FILE);
	}
});
