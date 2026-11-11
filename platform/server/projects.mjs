import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { uid, SerialQueue } from './store.mjs';
import { requireThat } from './errors.mjs';

export function requirementId(raw = '') {
  const value = raw.trim().toLowerCase() || `req${new Date().toISOString().slice(0,10).replaceAll('-', '')}${randomBytes(4).toString('hex')}`;
  requireThat(/^(?=.*[a-z])(?=.*\d)[a-z0-9]+$/.test(value), 'INVALID_REQUIREMENT_ID', '需求编号必须同时包含英文字母和数字', 400);
  return value;
}
export class ProjectService {
  constructor(store, repoFor, workRoot) {
    this.store = store; this.repoFor = repoFor; this.workRoot = workRoot; this.queue = new SerialQueue();
  }
  authorize(actor, projectId, permission = 'read') {
    requireThat(actor, 'UNAUTHORIZED', '请先登录', 401);
    const project = this.store.get('projects', projectId);
    const role = actor.projects?.[projectId] || actor.workspaces?.[project.workspace_id];
    const levels = { read: 1, developer: 2, reviewer: 3, maintainer: 4, admin: 5 };
    requireThat((levels[role] || 0) >= (levels[permission] || 99), 'FORBIDDEN', '没有该项目操作权限', 403);
    return project;
  }
  async createRequirement(actor, projectId, input) {
    const project = this.authorize(actor, projectId, 'developer');
    return this.queue.run(projectId, async () => {
      const id = requirementId(input.requirement_id), key = `${projectId}/${id}`;
      const old = this.store.get('requirements', key, false);
      if (old) {
        requireThat(input.idempotency_key && old.idempotency_key === input.idempotency_key,
          'DUPLICATE_REQUIREMENT', '需求编号已存在，请重新输入');
        requireThat(old.title === input.title && old.plane_id === input.plane_id, 'IDEMPOTENCY_CONFLICT', '重复请求内容不同');
        if (old.status !== 'creating') return old;
      }
      requireThat(input.title?.trim(), 'INVALID_TITLE', '需求名称不能为空', 400);
      const repo = this.repoFor(project); await repo.fetch();
      if (!old) requireThat(!await repo.hasBranch(id), 'UNKNOWN_BRANCH', '同名分支已存在，不能接管');
      const origin = old?.origin_commit || await repo.sha('refs/heads/main');
      const record = old || this.store.insert('requirements', { id: key, project_id: projectId,
        requirement_id: id, title: input.title, plane_id: input.plane_id, prd: input.prd,
        idempotency_key: input.idempotency_key, branch: id, origin_commit: origin,
        working_base_commit: origin, origin_release_id: project.current_release_id || null, status: 'creating' });
      if (!await repo.hasBranch(id)) await repo.branch(id, origin);
      else requireThat(await repo.sha(`refs/heads/${id}`) === origin, 'UNKNOWN_BRANCH', '创建中的分支已变化，需要核对');
      const change = this.store.list('changes', projectId).find(c => c.requirement_key === key)
        || this.store.insert('changes', { id: uid('change'), project_id: projectId, requirement_key: key, status: 'pending' });
      this.store.event(projectId, actor.id, 'requirement.created', key, { origin_commit: origin });
      return this.store.update('requirements', key, { status: 'active', change_id: change.id });
    });
  }
  async createIntegration(actor, projectId, reqId, input) {
    const project = this.authorize(actor, projectId, 'developer');
    return this.queue.run(projectId, async () => {
      const req = this.store.get('requirements', `${projectId}/${reqId}`);
      requireThat(req.status === 'active', 'INVALID_REQUIREMENT', '需求尚未就绪');
      const previous = this.store.list('attempts', projectId).find(a => a.requirement_key === req.id && a.idempotency_key === input.idempotency_key);
      if (input.idempotency_key && previous) return previous;
      const repo = this.repoFor(project); await repo.fetch();
      const source = await repo.sha(`refs/heads/${req.branch}`), base = await repo.sha('refs/heads/main');
      const id = uid('int'), branch = `integration/${reqId}/${id}`, workdir = join(this.workRoot, id);
      const attempt = this.store.insert('attempts', { id, project_id: projectId, requirement_key: req.id,
        change_id: req.change_id, source_head_sha: source, target_main_sha: base, prd: req.prd,
        branch, workdir, status: 'integrating', idempotency_key: input.idempotency_key });
      try {
        const result = await repo.integrate(base, source, workdir, branch);
        this.store.event(projectId, actor.id, 'integration.created', id, { source, base });
        return this.store.update('attempts', id, { ...result, status: result.conflicts.length ? 'awaiting_manual_resolution' : 'awaiting_verification' });
      } catch (error) { this.store.update('attempts', id, { status: 'failed', error: error.message }); throw error; }
    });
  }
  async startSync(actor, projectId, reqId, input) {
    const project = this.authorize(actor, projectId, 'developer');
    return this.queue.run(projectId, async () => {
      const req = this.store.get('requirements', `${projectId}/${reqId}`);
      const previous = this.store.list('syncs', projectId).find(s => s.requirement_key === req.id && s.idempotency_key === input.idempotency_key);
      if (input.idempotency_key && previous) return previous;
      const repo = this.repoFor(project); await repo.fetch();
      const target = await repo.sha(input.target), main = await repo.sha('refs/heads/main');
      requireThat(await repo.ancestor(target, main), 'TARGET_NOT_MAIN', '目标版本尚未进入 main');
      const source = await repo.sha(`refs/heads/${req.branch}`), id = uid('sync'), workdir = join(this.workRoot, id);
      const sync = this.store.insert('syncs', { id, project_id: projectId, requirement_key: req.id,
        change_id: req.change_id, source_head_sha: source, old_base: req.working_base_commit,
        target_commit: target, actor: actor.id, workdir, status: 'integrating', idempotency_key: input.idempotency_key });
      if (await repo.ancestor(target, source)) return this.store.update('syncs', id, { status: 'already_included' });
      try {
        const result = await repo.integrate(source, target, workdir, `sync/${reqId}/${id}`);
        return this.store.update('syncs', id, { ...result, had_conflicts: !!result.conflicts.length,
          status: result.conflicts.length ? 'awaiting_manual_resolution' : 'awaiting_verification' });
      } catch (error) { this.store.update('syncs', id, { status: 'failed', error: error.message }); throw error; }
    });
  }
  async finishSync(actor, syncId, verification) {
    const sync = this.store.get('syncs', syncId), project = this.authorize(actor, sync.project_id, 'developer');
    return this.queue.run(project.id, async () => {
      const req = this.store.get('requirements', sync.requirement_key), repo = this.repoFor(project);
      requireThat(sync.status === 'awaiting_verification' || sync.status === 'awaiting_manual_resolution', 'INVALID_STATE', '同步状态不允许完成');
      // verification is supplied by the trusted runner service, never directly from HTTP input.
      const head = await repo.resolved(sync.workdir, [sync.source_head_sha, sync.target_commit]);
      requireThat(verification?.passed && verification.commit === head, 'VERIFICATION_REQUIRED', '缺少对应提交的验证结果');
      if (sync.had_conflicts) requireThat(verification.confirmed_by && verification.preview_build_id, 'CONFIRMATION_REQUIRED', '冲突修复需预览并人工确认');
      await repo.fetch();
      requireThat(await repo.sha(`refs/heads/${req.branch}`) === sync.source_head_sha, 'STALE_SYNC', '需求分支已有新提交，保留结果并重新同步');
      await repo.compareAndSetBranch(req.branch, head, sync.source_head_sha);
      this.store.update('requirements', req.id, { working_base_commit: sync.target_commit });
      this.store.event(project.id, actor.id, 'base.synced', sync.id, { commit: head, target: sync.target_commit });
      return this.store.update('syncs', syncId, { status: 'completed', candidate_commit: head, verification });
    });
  }
}
