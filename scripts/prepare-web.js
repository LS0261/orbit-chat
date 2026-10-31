const fs = require('fs');
const path = require('path');
const source = path.join(__dirname, '..', 'public');
const target = path.join(__dirname, '..', 'www');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log('Frontend copiado a www/');
