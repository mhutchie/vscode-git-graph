const fs = require('fs');
const path = require('path');

function deleteFolderAndFiles(directory) {
	if (fs.existsSync(directory)) {
		fs.readdirSync(directory).forEach((fileName) => {
			const fullPath = path.join(directory, fileName);
			if (fs.statSync(fullPath).isDirectory()) {
				// The entry is a folder, recursively delete its contents
				deleteFolderAndFiles(fullPath);
			} else {
				// The entry is a file, delete it
				fs.unlinkSync(fullPath);
			}
		});
		// The directory is now empty, so it can be deleted.
		fs.rmdirSync(directory);
	}
}

deleteFolderAndFiles('./media');
deleteFolderAndFiles('./out');
