import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { loadPrototype } from './config.mjs';
import { uid } from './store.mjs';
import { requireThat, PlatformError } from './errors.mjs';
const execute = promisify(execFile);

export class DockerRunner {
  constructor({ image, outputRoot }) { this.image = image; this.outputRoot = outputRoot; }
  async build(source, project) {
    requireThat(this.image, 'RUNNER_NOT_CONFIGURED', '未配置受限构建镜像');
    const config = await loadPrototype(source, project), output = join(this.outputRoot, uid('run'));
    await mkdir(output, { recursive: true });
    // The source is read-only; the only writable host mount is this fresh output.
    // No Docker socket, credential mount, host network or inherited host env.
    try {
      await execute('docker', ['run', '--rm', '--network=none', '--cap-drop=ALL', '--security-opt=no-new-privileges',
        '--memory=2g', '--cpus=2', '--pids-limit=256', '--read-only', '--tmpfs', '/tmp:rw,exec,size=1g',
        '--mount', `type=bind,source=${resolve(source)},target=/source,readonly`,
        '--mount', `type=bind,source=${resolve(output)},target=/output`,
        this.image, 'node', '/runner/build.mjs'], { timeout: 300000, maxBuffer: 8 * 1024 * 1024 });
    } catch (error) { throw new PlatformError('BUILD_FAILED', String(error.stderr || error.message).slice(-4000), 422); }
    const result = JSON.parse(await readFile(join(output, 'runner-result.json'), 'utf8'));
    requireThat(result.passed === true, 'BUILD_FAILED', '构建未通过');
    return { output, config, result };
  }
}
