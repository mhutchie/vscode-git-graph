const fs = require('fs');
const path = require('path');

function deleteFolderAndFiles(directory) {
	if (fs.existsSync(directory)) {
		fs.readdirSync(directory).forEach((filename) => {
			const fullPath = path.join(directory, filename);
			if (fs.statSync(fullPath).isDirectory()) {
				deleteFolderAndFiles(fullPath);
			} else {
				fs.unlinkSync(fullPath);
			}
		});
		fs.rmdirSync(directory);
	}
}

deleteFolderAndFiles('./out');
