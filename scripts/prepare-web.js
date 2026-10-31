const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const source = path.join(root, 'public');
const target = path.join(root, 'www');

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'file-picker-entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: path.join(target, 'file-picker.js')
});

console.log('Frontend y selector multimedia preparados en www/');
