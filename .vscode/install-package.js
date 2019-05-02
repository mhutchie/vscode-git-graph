const cp = require('child_process');

const PACKAGED_FILE = './' + process.env.npm_package_name + '-' + process.env.npm_package_version + '.vsix';

console.log('');
cp.exec('code --install-extension ' + PACKAGED_FILE, { cwd: process.cwd() }, (err, stdout, stderr) => {
	if (err) {
		console.log('ERROR:');
		console.log(err);
		process.exit(1);
	} else {
		console.log(stderr + stdout);
	}
});
