import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyMetadata(local, published, tag, workspace) {
  if (published.version !== local.version || published['dist-tags']?.[tag] !== local.version) {
    throw new Error(`Version/tag mismatch for ${local.name}@${local.version} (${tag})`);
  }
  for (const [name, range] of Object.entries(local.dependencies ?? {})) {
    if (!range.startsWith('workspace:')) continue;
    const prefix = range.slice('workspace:'.length);
    if (!['^', '~', '*'].includes(prefix) || !workspace.has(name)) {
      throw new Error(`Unsupported workspace dependency: ${name} ${range}`);
    }
    const expected = `${prefix === '*' ? '' : prefix}${workspace.get(name)}`;
    if (published.dependencies?.[name] !== expected) {
      throw new Error(`Dependency mismatch: ${name}, expected ${expected}, got ${published.dependencies?.[name]}`);
    }
  }
}

async function main() {
  const manifestPath = process.argv[2] ?? 'package.json';
  const tag = process.env.NPM_TAG ?? 'latest';
  const load = path => JSON.parse(readFileSync(path, 'utf8'));
  const local = load(manifestPath);
  const manifests = [load('package.json'), ...readdirSync('packages', { withFileTypes: true }).filter(e => e.isDirectory()).flatMap(e => {
    try { return [load(`packages/${e.name}/package.json`)]; }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  })];
  const workspace = new Map(manifests.map(m => [m.name, m.version]));
  const spec = `${local.name}@${local.version}`;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const published = JSON.parse(execFileSync('npm', ['view', spec, '--json', '--registry=https://npm.pkg.github.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      verifyMetadata(local, published, tag, workspace);
      console.log(JSON.stringify({ verified: spec, tag, dependencies: published.dependencies ?? {} }));
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      console.log(`Registry readback not ready for ${spec}; retry ${attempt}/10`);
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
