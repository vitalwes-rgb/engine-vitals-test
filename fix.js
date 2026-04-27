import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/\\\${/g, '${');
code = code.replace(/\\\`/g, '`');
fs.writeFileSync('server.ts', code);
