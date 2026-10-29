import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A standalone deployment containing only LinguaFlash and its public endpoint.
// Copy an explicit file list so local .env files and unrelated apps stay local.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.deploy', 'linguaflash');
function copy(source, target) {
  if (statSync(source).isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const name of readdirSync(source)) copy(path.join(source, name), path.join(target, name));
  } else {
    writeFileSync(target, readFileSync(source));
  }
}
mkdirSync(path.join(output, 'LinguaFlash'), { recursive: true });
for (const item of ['src', 'server', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json']) {
  copy(path.join(root, 'LinguaFlash', item), path.join(output, 'LinguaFlash', item));
}
if (existsSync(path.join(root, 'LinguaFlash', 'public'))) {
  copy(path.join(root, 'LinguaFlash', 'public'), path.join(output, 'LinguaFlash', 'public'));
}
mkdirSync(path.join(output, 'shared'), { recursive: true });
copy(path.join(root, 'shared', 'apiKeys.js'), path.join(output, 'shared', 'apiKeys.js'));
mkdirSync(path.join(output, 'api'), { recursive: true });
copy(path.join(root, 'api', 'glosor.mjs'), path.join(output, 'api', 'glosor.mjs'));
writeFileSync(path.join(output, 'package.json'), JSON.stringify({ name: 'linguaflash-deployment', private: true }, null, 2));
writeFileSync(path.join(output, 'vercel.json'), JSON.stringify({
  framework: null,
  installCommand: 'npm --prefix LinguaFlash ci',
  buildCommand: 'npm --prefix LinguaFlash run build',
  outputDirectory: 'LinguaFlash/dist',
  functions: { 'api/glosor.mjs': { maxDuration: 30 } },
}, null, 2));
writeFileSync(path.join(output, '.vercelignore'), '**/node_modules\n**/.env*\n**/*.test.js\n');
console.log(`Standalone LinguaFlash deployment prepared at ${output}`);
