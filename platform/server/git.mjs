import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { requireThat, PlatformError } from './errors.mjs';
const execute = promisify(execFile);
export async function git(cwd, args, options = {}) {
  try {
    const { stdout } = await execute('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Prototype Platform',
        GIT_AUTHOR_EMAIL: 'prototype@localhost', GIT_COMMITTER_NAME: 'Prototype Platform',
        GIT_COMMITTER_EMAIL: 'prototype@localhost', ...options.env }
    });
    return stdout.trim();
  } catch (error) {
    // Git stderr can contain credential URLs; expose only bounded, redacted diagnostics.
    const message = String(error.stderr || error.message).replace(/https?:\/\/[^\s]+/g, '[repository URL]').slice(0, 2500);
    throw new PlatformError('GIT_FAILED', message, 409);
  }
}
export function branchName(value) {
  requireThat(typeof value === 'string' && /^[a-z0-9][a-z0-9/_-]*$/.test(value)
    && !value.includes('//') && !value.endsWith('/'), 'INVALID_BRANCH', '分支名格式不正确', 400);
  return value;
}
export class GitRepository {
  constructor(path, { remote = false, token } = {}) {
    this.path = resolve(path); this.remote = remote;
    this.env = token ? { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`oauth2:${token}`).toString('base64')}` } : {};
  }
  run(args, cwd = this.path) { return git(cwd, args, { env: this.env }); }
  async fetch() { if (this.remote) await this.run(['fetch', 'origin', '+refs/heads/*:refs/heads/*']); }
  async sha(ref) {
    requireThat(typeof ref === 'string' && !ref.startsWith('-') && !/[\s:~^?*\[\\]/.test(ref), 'INVALID_REF', '版本引用无效', 400);
    return this.run(['rev-parse', '--verify', `${ref}^{commit}`]);
  }
  async hasBranch(name) { try { await this.sha(`refs/heads/${branchName(name)}`); return true; } catch { return false; } }
  async branch(name, sha) {
    await this.run(['branch', branchName(name), sha]);
    if (this.remote) await this.run(['push', 'origin', `refs/heads/${name}:refs/heads/${name}`]);
  }
  async ancestor(a, b) { try { await this.run(['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } }
  async checkout(sha, destination) {
    await mkdir(dirname(destination), { recursive: true });
    await this.run(['worktree', 'add', '--detach', destination, sha]);
    return destination;
  }
  async integrate(target, source, destination, name) {
    await this.checkout(target, destination);
    await this.run(['switch', '-c', branchName(name)], destination);
    try {
      await this.run(['merge', '--no-edit', source], destination);
      return { candidate_commit: await this.run(['rev-parse', 'HEAD'], destination), conflicts: [] };
    } catch (error) {
      const conflicts = (await this.run(['diff', '--name-only', '--diff-filter=U'], destination)).split('\n').filter(Boolean);
      if (!conflicts.length) throw error;
      return { candidate_commit: null, conflicts };
    }
  }
  async resolved(destination, expectedParents) {
    const unresolved = await this.run(['diff', '--name-only', '--diff-filter=U'], destination);
    requireThat(!unresolved, 'UNRESOLVED_CONFLICT', '仍有未解决冲突');
    const status = await this.run(['status', '--porcelain'], destination);
    requireThat(!status, 'UNCOMMITTED_RESOLUTION', '冲突处理须先提交');
    const head = await this.run(['rev-parse', 'HEAD'], destination);
    for (const parent of expectedParents) requireThat(await this.ancestor(parent, head), 'INVALID_RESOLUTION', '处理结果未保留冻结来源');
    return head;
  }
  async compareAndSetBranch(name, head, expected) {
    branchName(name);
    requireThat(await this.ancestor(expected, head), 'NON_FAST_FORWARD', '禁止回退或丢弃分支修改');
    // update-ref's old-value argument is the local atomic compare-and-swap.
    // Remote force-with-lease is used only after ancestry validation, never to rewind.
    if (this.remote) await this.run(['push', `--force-with-lease=refs/heads/${name}:${expected}`, 'origin', `${head}:refs/heads/${name}`]);
    await this.run(['update-ref', `refs/heads/${name}`, head, expected]);
  }
  async text(sha, path) {
    requireThat(!path.startsWith('/') && !path.includes('..') && !path.includes('\\'), 'INVALID_PATH', '仓库路径无效', 400);
    return this.run(['show', `${sha}:${path}`]);
  }
  async publishCandidate(name) { if (this.remote) await this.run(['push', 'origin', `refs/heads/${branchName(name)}:refs/heads/${name}`]); }
  static async clone(url, path, token) {
    const repo = new GitRepository(path, { remote: true, token });
    await mkdir(dirname(repo.path), { recursive: true });
    await git(dirname(repo.path), ['clone', '--bare', url, repo.path], { env: repo.env });
    return repo;
  }
}
