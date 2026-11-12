import { execFileSync } from 'node:child_process';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
const config = YAML.parse(await readFile('prototype.yaml', 'utf8'));
const storybook = JSON.parse(await readFile('node_modules/storybook/package.json', 'utf8'));
const cli = resolve('node_modules/storybook', typeof storybook.bin === 'string' ? storybook.bin : storybook.bin.storybook);
for (const app of config.applications) {
  execFileSync(process.execPath, [cli, 'build', '--disable-telemetry',
    '--config-dir', resolve(app.root, '.storybook'), '--output-dir', resolve(app.output)], { stdio: 'inherit' });
}
const base = 'packages/prototype-player';
await mkdir(`${base}/dist/runtime`, { recursive: true });
await copyFile(`${base}/index.html`, `${base}/dist/index.html`);
await copyFile(`${base}/player.js`, `${base}/dist/runtime/player.js`);
await copyFile(`${base}/player.css`, `${base}/dist/runtime/player.css`);
