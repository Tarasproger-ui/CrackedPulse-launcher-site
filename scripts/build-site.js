const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const from = path.join(root, 'public');
const to = path.join(root, 'dist-site');

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log('Built static site to dist-site');
