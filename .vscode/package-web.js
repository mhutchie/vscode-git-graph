const cp = require('child_process');
const fs = require('fs');

const MEDIA_DIRECTORY = './media/';
const STYLES_DIRECTORY = './web/styles/';

const MAIN_CSS_FILE = 'main.css';
const MAIN_JS_FILE = 'main.js';
const UTILS_JS_FILE = 'utils.js';

const OUTPUT_MIN_CSS_FILE = 'out.min.css';
const OUTPUT_MIN_JS_FILE = 'out.min.js';
const OUTPUT_TMP_JS_FILE = 'out.tmp.js';

const DEBUG = process.argv.length > 2 && process.argv[2] === 'debug';


// Determine the JS files to be packaged. The order is: utils.ts, *.ts, and then main.ts
let packageJsFiles = [MEDIA_DIRECTORY + UTILS_JS_FILE];
fs.readdirSync(MEDIA_DIRECTORY).forEach(filename => {
	if (filename.endsWith('.js') && filename !== OUTPUT_MIN_JS_FILE && filename !== UTILS_JS_FILE && filename !== MAIN_JS_FILE) packageJsFiles.push(MEDIA_DIRECTORY + filename);
});
packageJsFiles.push(MEDIA_DIRECTORY + MAIN_JS_FILE);

// Determine the CSS files to be packaged. The order is: main.css, and then *.css
let packageCssFiles = [STYLES_DIRECTORY + MAIN_CSS_FILE];
fs.readdirSync(STYLES_DIRECTORY).forEach(filename => {
	if (filename.endsWith('.css') && filename !== MAIN_CSS_FILE) packageCssFiles.push(STYLES_DIRECTORY + filename);
});

// Log packaging information
console.log('Packaging CSS files: ' + packageCssFiles.join(', '));
console.log('Packaging JS files: ' + packageJsFiles.join(', '));
if (DEBUG) console.log('Debug Mode = ON');


// Combine the JS files into an IIFE, with a single "use strict" directive
let jsFileContents = '';
packageJsFiles.forEach(filename => {
	jsFileContents += fs.readFileSync(filename).toString().replace('"use strict";\r\n', '') + '\r\n';
	fs.unlinkSync(filename);
});
fs.writeFileSync(MEDIA_DIRECTORY + OUTPUT_TMP_JS_FILE, '"use strict";\r\n(function(document, window){\r\n' + jsFileContents + '})(document, window);\r\n');


// Run uglifyjs with the required arguments
cp.exec('uglifyjs ' + MEDIA_DIRECTORY + OUTPUT_TMP_JS_FILE + ' ' + (DEBUG ? '-b' : '--mangle') + ' --output ' + MEDIA_DIRECTORY + OUTPUT_MIN_JS_FILE, (err, stdout, stderr) => {
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
		fs.unlinkSync(MEDIA_DIRECTORY + OUTPUT_TMP_JS_FILE);
	}
});

// Combine the CSS files
let cssFileContents = '';
packageCssFiles.forEach(filename => {
	let contents = fs.readFileSync(filename).toString();
	if (DEBUG) {
		cssFileContents += contents + '\r\n';
	} else {
		let lines = contents.split(/\r\n|\r|\n/g);
		for (let j = 0; j < lines.length; j++) {
			if (lines[j].startsWith('\t')) lines[j] = lines[j].substring(1);
		}
		let j = 0;
		while (j < lines.length) {
			if (lines[j].startsWith('/*') && lines[j].endsWith('*/')) {
				lines.splice(j, 1);
			} else {
				j++;
			}
		}
		cssFileContents += lines.join('');
	}
});
fs.writeFileSync(MEDIA_DIRECTORY + OUTPUT_MIN_CSS_FILE, cssFileContents);
