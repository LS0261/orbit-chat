const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const source = path.join(root, 'public');
const target = path.join(root, 'www');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
execFileSync(process.execPath, [
  path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  path.join(__dirname, 'file-picker-entry.js'),
  '--bundle', '--format=iife', '--platform=browser',
  '--outfile=' + path.join(target, 'file-picker.js')
], { stdio: 'inherit' });
console.log('Frontend y selector multimedia preparados en www/');
