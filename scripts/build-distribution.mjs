// Package only npm's allowlisted distribution files. Hosting the immutable
// tarball beside onboarding avoids a private GitHub repository login gate.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const target = new URL(`public/downloads/ifocksh-kages-${pkg.version}.tgz`, root);
if (existsSync(target)) throw Error('A distribution asset already exists for this version. Bump the version; do not replace released bytes.');
mkdirSync(new URL('public/downloads/', root), { recursive: true });
execFileSync('npm', ['pack', '--pack-destination', fileURLToPath(new URL('public/downloads/', root))], { cwd: root, stdio: 'inherit' });
