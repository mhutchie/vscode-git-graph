const fs = require('fs');
const path = require('path');
const directory = './out';

fs.readdir(directory, (err, files) => {
	if (err) return;

	for (const file of files) {
		fs.unlink(path.join(directory, file), err => {
			if (err) throw err;
		});
	}
});