import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, GitRepository } from '../server/git.mjs';
import { Store } from '../server/store.mjs';
import { ProjectService, requirementId } from '../server/projects.mjs';
import { validatePrototype } from '../server/config.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'prototype-branches-'));
  const source = join(root, 'source'); await mkdir(source);
  await git(source, ['init', '-b', 'main']);
  await writeFile(join(source, 'login.txt'), 'password\n');
  await git(source, ['add', 'login.txt']); await git(source, ['commit', '-m', 'initial']);
  const bare = join(root, 'repo.git'); await git(root, ['clone', '--bare', source, bare]);
  const repo = new GitRepository(bare), store = new Store(':memory:');
  store.insert('workspaces', { id: 'lab' });
  store.insert('projects', { id: 'retail', workspace_id: 'lab' });
  const service = new ProjectService(store, () => repo, join(root, 'work'));
  const actor = { id: 'developer', projects: { retail: 'developer' } };
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  return { root, repo, store, service, actor };
}
async function edit(f, branch, content, file = 'login.txt') {
  const path = join(f.root, `edit-${branch}-${Date.now()}`);
  await f.repo.checkout(await f.repo.sha(`refs/heads/${branch}`), path);
  await writeFile(join(path, file), content);
  await f.repo.run(['add', file], path); await f.repo.run(['commit', '-m', 'business change'], path);
  const head = await f.repo.run(['rev-parse', 'HEAD'], path);
  await f.repo.compareAndSetBranch(branch, head, await f.repo.sha(`refs/heads/${branch}`));
  return head;
}
test('需求分支幂等创建，未知同名分支不接管，空分支不构建', async t => {
  const f = await fixture(t);
  const input = { requirement_id: ' ReqQR001 ', title: '二维码登录', idempotency_key: 'create-1' };
  const first = await f.service.createRequirement(f.actor, 'retail', input);
  assert.equal(first.branch, 'reqqr001');
  assert.equal((await f.service.createRequirement(f.actor, 'retail', input)).id, first.id);
  assert.equal(f.store.list('builds').length, 0);
  assert.equal(f.store.list('changes').length, 1);
  await f.repo.branch('unknown1', first.origin_commit);
  await assert.rejects(f.service.createRequirement(f.actor, 'retail', { requirement_id: 'unknown1', title: 'unknown' }), { code: 'UNKNOWN_BRANCH' });
  assert.throws(() => requirementId('abc'), { code: 'INVALID_REQUIREMENT_ID' });
  await assert.rejects(f.service.createRequirement({ id: 'other', projects: {} }, 'retail', input), { code: 'FORBIDDEN' });
});
test('独立候选保留冻结来源，冲突不改需求分支和 main', async t => {
  const f = await fixture(t);
  await f.service.createRequirement(f.actor, 'retail', { requirement_id: 'reqqr001', title: 'QR' });
  await f.service.createRequirement(f.actor, 'retail', { requirement_id: 'reqsms001', title: 'SMS' });
  const qr = await edit(f, 'reqqr001', 'password + QR\n');
  const sms = await edit(f, 'reqsms001', 'password + SMS\n');
  await f.repo.compareAndSetBranch('main', qr, await f.repo.sha('main'));
  const attempt = await f.service.createIntegration(f.actor, 'retail', 'reqsms001', { idempotency_key: 'int1' });
  assert.equal(attempt.status, 'awaiting_manual_resolution');
  assert.deepEqual(attempt.conflicts, ['login.txt']);
  assert.equal(await f.repo.sha('reqsms001'), sms);
  assert.equal(await f.repo.sha('main'), qr);
  assert.equal((await f.service.createIntegration(f.actor, 'retail', 'reqsms001', { idempotency_key: 'int1' })).id, attempt.id);
});
test('指定主线同步保留业务修改，拒绝未合入目标和并发覆盖', async t => {
  const f = await fixture(t);
  const req = await f.service.createRequirement(f.actor, 'retail', { requirement_id: 'reqsms001', title: 'SMS' });
  await edit(f, 'reqsms001', 'sms feature', 'sms.txt');
  const target = await edit(f, 'main', 'shared feature', 'shared.txt');
  const sync = await f.service.startSync(f.actor, 'retail', 'reqsms001', { target });
  assert.equal(sync.status, 'awaiting_verification');
  await f.service.finishSync(f.actor, sync.id, { passed: true, commit: sync.candidate_commit });
  assert.equal(await f.repo.text(await f.repo.sha('reqsms001'), 'sms.txt'), 'sms feature');
  assert.equal(f.store.get('requirements', req.id).origin_commit, req.origin_commit);
  assert.equal(f.store.get('requirements', req.id).working_base_commit, target);
  const later = await edit(f, 'reqsms001', 'later', 'later.txt');
  await assert.rejects(f.service.startSync(f.actor, 'retail', 'reqsms001', { target: later }), { code: 'TARGET_NOT_MAIN' });
  const target2 = await edit(f, 'main', 'next', 'next.txt');
  const next = await f.service.startSync(f.actor, 'retail', 'reqsms001', { target: target2 });
  const latest = await edit(f, 'reqsms001', 'concurrent', 'concurrent.txt');
  await assert.rejects(f.service.finishSync(f.actor, next.id, { passed: true, commit: next.candidate_commit }), { code: 'STALE_SYNC' });
  assert.equal(await f.repo.sha('reqsms001'), latest);
});
test('应用注册不写死端名，业务路由和路径需有效', () => {
  const config = { schema_version: 1, workspace_id: 'lab', project_id: 'retail', repository: { default_branch: 'main' },
    applications: [{ id: 'kiosk', name: '新端', root: 'apps/kiosk', output: 'apps/kiosk/storybook-static',
      build_command: 'pnpm --filter kiosk build-storybook', entry: '/home', screens: [{ route: '/home', story_id: 'kiosk-application--interactive' }] }] };
  assert.equal(validatePrototype(config, { id: 'retail', workspace_id: 'lab' }).applications[0].id, 'kiosk');
  config.applications[0].output = '../outside';
  assert.throws(() => validatePrototype(config, { id: 'retail', workspace_id: 'lab' }), { code: 'INVALID_PATH' });
});
