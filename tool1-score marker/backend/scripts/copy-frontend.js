const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '../../frontend');
const targetDir = path.resolve(__dirname, '../dist/frontend');

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Frontend directory not found: ${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied frontend assets to ${targetDir}`);
