const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const versionPath = path.join(__dirname, '../version.json');
let version = { build: 0, date: '' };

try {
    version = require(versionPath);
} catch (e) {
    // If file doesn't exist or is invalid, start fresh
}

// Increment build number
version.build++;
version.date = new Date().toISOString();

// Write back to file
fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

// Stage the file so it is included in the current commit
exec(`git add ${versionPath}`, (err, stdout, stderr) => {
    if (err) {
        console.error('Error staging version.json:', stderr);
        process.exit(1);
    }
});
