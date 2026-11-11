import { cp, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
await mkdir('/tmp/work', { recursive: true });
await cp('/source', '/tmp/work', { recursive: true, filter: path => !/(^|\/)(\.git|node_modules|storybook-static|dist)(\/|$)/.test(path) });
// Use the preinstalled, pinned dependency set. Build jobs have no network access.
const lock = await readFile('/tmp/work/package-lock.json');
const installed = await readFile('/deps/package-lock.json');
const hash = value => createHash('sha256').update(JSON.stringify(JSON.parse(value.toString()))).digest('hex');
if (hash(lock) !== hash(installed)) throw new Error('依赖锁已变化，请先构建匹配的受控 Runner 镜像');
await cp('/deps/node_modules', '/tmp/work/node_modules', { recursive: true });
process.chdir('/tmp/work');
execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', timeout: 240000 });
await cp('/tmp/work', '/output', { recursive: true, filter: path => !/(^|\/)(\.git|node_modules)(\/|$)/.test(path) });
await writeFile('/output/runner-result.json', JSON.stringify({ passed: true, node: process.version, dependency_digest: hash(lock) }));
