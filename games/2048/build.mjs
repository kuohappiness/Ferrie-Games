import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const assets = { '/': readFileSync('index.html', 'utf8'), '/social.js': readFileSync('social.js', 'utf8') };
mkdirSync('dist/server', { recursive: true });
writeFileSync('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + readFileSync('worker.js', 'utf8'));
