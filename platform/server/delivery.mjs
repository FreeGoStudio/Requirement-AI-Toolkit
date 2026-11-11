import { join } from 'node:path';
import { uid, now } from './store.mjs';
import { requireThat } from './errors.mjs';
import { digest } from './artifacts.mjs';
import { verifyBrowser } from './browser-verifier.mjs';

export class DeliveryService {
  constructor(projects, artifacts, runner, gitlab, browserOptions = {}) {
    this.projects = projects; this.store = projects.store; this.artifacts = artifacts;
    this.runner = runner; this.gitlab = gitlab;
    this.browserOptions = browserOptions;
  }
  async build(actor, projectId, reqId, { attempt_id, history_ref, idempotency_key }) {
    const project = this.projects.authorize(actor, projectId, 'developer');
    return this.projects.queue.run(projectId, async () => {
      const req = this.store.get('requirements', `${projectId}/${reqId}`);
      requireThat(req.prototype_applicable !== false, 'PROTOTYPE_NOT_APPLICABLE', '纯文档需求不构建原型');
      const operationId = `${projectId}/build/${idempotency_key}`;
      requireThat(idempotency_key, 'IDEMPOTENCY_REQUIRED', '构建需提供请求标识', 400);
      const old = this.store.get('operations', operationId, false);
      requireThat(!old || (old.requirement_key === req.id && old.attempt_id === attempt_id && old.history_ref === history_ref), 'IDEMPOTENCY_CONFLICT', '构建标识已用于其他来源');
      if (old?.status === 'completed') return this.store.get('builds', old.build_id);
      requireThat(!old || old.status === 'failed', 'OPERATION_RUNNING', '构建执行中或中断待核对');
      const repo = this.projects.repoFor(project); await repo.fetch();
      let source, workdir, attempt;
      if (attempt_id) {
        attempt = this.store.get('attempts', attempt_id);
        requireThat(attempt.project_id === projectId && attempt.requirement_key === req.id, 'INVALID_ATTEMPT', '候选不属于该需求');
        requireThat(['awaiting_verification','awaiting_manual_resolution'].includes(attempt.status), 'FROZEN_ATTEMPT', '已冻结候选不能覆盖重建');
        source = await repo.resolved(attempt.workdir, [attempt.source_head_sha, attempt.target_main_sha]);
        workdir = attempt.workdir;
      } else {
        source = await repo.sha(history_ref || `refs/heads/${req.branch}`);
        const existingBuild = this.store.list('builds', projectId).find(b => b.requirement_id === reqId && !b.attempt_id && !!b.reproduction === !!history_ref && b.source_commit === source && b.browser_evidence?.passed);
        if (existingBuild) { await this.artifacts.verify(existingBuild.id); return existingBuild; }
        workdir = join(this.projects.workRoot, uid('preview'));
        await repo.checkout(source, workdir);
      }
      const operation = { status: 'running', source_commit: source, requirement_key: req.id, attempt_id, history_ref };
      if (old) this.store.update('operations', operationId, operation);
      else this.store.insert('operations', { id: operationId, project_id: projectId, ...operation });
      try {
        const built = await this.runner.build(workdir, project);
        const artifact = await this.artifacts.collect(project, built.output, built.config, reqId, {
          source_commit: source, candidate_commit: attempt ? source : null, attempt_id: attempt?.id,
          source_branch: attempt ? attempt.branch : req.branch, reproduction: !!history_ref, history_ref, toolchain: built.result });
        await this.artifacts.restore(artifact.id);
        const browserEvidence = await verifyBrowser(artifact, this.browserOptions);
        this.store.update('builds', artifact.id, { browser_evidence: browserEvidence });
        if (attempt) {
          // Freeze only after build and archive checks; browser evidence remains separate.
          this.store.update('attempts', attempt.id, { candidate_commit: source, build_id: artifact.id,
            status: 'awaiting_acceptance', conflicts_resolved: !!attempt.conflicts?.length,
            verification: { commit: source, build_passed: true, browser_passed: browserEvidence.passed, browser_evidence: browserEvidence } });
        }
        this.store.update('operations', operationId, { status: 'completed', build_id: artifact.id });
        return artifact;
      } catch (error) {
        this.store.update('operations', operationId, { status: 'failed', error: error.message }); throw error;
      }
    });
  }
  async publishPreview(actor, projectId, reqId, buildId, key) {
    this.projects.authorize(actor, projectId, 'developer');
    return this.projects.queue.run(projectId, async () => {
      const req = this.store.get('requirements', `${projectId}/${reqId}`);
      const old = this.store.list('previews', projectId).find(p => p.idempotency_key === key && p.requirement_key === req.id);
      if (key && old) return old;
      const current = req.preview_id ? this.store.get('previews', req.preview_id) : null;
      if (current?.build_id === buildId) return current;
      const build = await this.artifacts.verify(buildId);
      requireThat(build.project_id === projectId && build.requirement_id === reqId && !build.attempt_id && !build.reproduction && !build.sync_id,
        'INVALID_PREVIEW', '需求预览只能使用该需求分支构建');
      await this.artifacts.restore(buildId);
      const record = this.store.insert('previews', { id: uid('preview'), project_id: projectId,
        requirement_key: req.id, build_id: buildId, source_commit: build.source_commit,
        status: 'published', idempotency_key: key, published_at: now() });
      this.store.update('requirements', req.id, { preview_id: record.id });
      this.store.event(projectId, actor.id, 'preview.published', record.id);
      return record;
    });
  }
  async verifySync(actor, syncId) {
    const sync = this.store.get('syncs', syncId), project = this.projects.authorize(actor, sync.project_id, 'developer');
    const req = this.store.get('requirements', sync.requirement_key), repo = this.projects.repoFor(project);
    requireThat(['awaiting_verification','awaiting_manual_resolution'].includes(sync.status), 'INVALID_STATE', '同步不处于待验证状态');
    const head = await repo.resolved(sync.workdir, [sync.source_head_sha, sync.target_commit]);
    const built = await this.runner.build(sync.workdir, project);
    const artifact = await this.artifacts.collect(project, built.output, built.config, req.requirement_id,
      { source_commit: head, source_branch: req.branch, sync_id: sync.id, toolchain: built.result });
    const browser = await verifyBrowser(artifact, this.browserOptions);
    this.store.update('builds', artifact.id, { browser_evidence: browser });
    const verification = { passed: true, commit: head, preview_build_id: artifact.id, browser_evidence: browser };
    this.store.update('syncs', syncId, { verification, candidate_commit: head });
    if (sync.had_conflicts) return this.store.update('syncs', syncId, { status: 'awaiting_verification', confirmation_required: true });
    return this.projects.finishSync(actor, syncId, verification);
  }
  async confirmSync(actor, syncId, buildId) {
    const sync = this.store.get('syncs', syncId);
    this.projects.authorize(actor, sync.project_id, 'reviewer');
    requireThat(actor.kind === 'human' && sync.confirmation_required && sync.verification?.preview_build_id === buildId,
      'CONFIRMATION_REQUIRED', '须由人工确认对应的冲突修复预览');
    await this.artifacts.verify(buildId);
    return this.projects.finishSync(actor, syncId, { ...sync.verification, confirmed_by: actor.id });
  }
  async accept(actor, attemptId, input) {
    const attempt = this.store.get('attempts', attemptId);
    const project = this.projects.authorize(actor, attempt.project_id, 'reviewer');
    requireThat(actor.kind === 'human', 'HUMAN_REQUIRED', '人工验收不能由 Agent 身份签发', 403);
    return this.projects.queue.run(project.id, async () => {
      const fresh = this.store.get('attempts', attemptId);
      if (fresh.snapshot_id) return this.store.get('snapshots', fresh.snapshot_id);
      requireThat(fresh.status === 'awaiting_acceptance', 'NOT_READY', '候选尚未完成构建验证');
      requireThat(fresh.verification?.browser_passed, 'BROWSER_VERIFICATION_REQUIRED', '缺少固定产物的浏览器验证');
      const build = await this.artifacts.verify(fresh.build_id);
      const req = this.store.get('requirements', fresh.requirement_key);
      requireThat(input.build_id === build.id && input.candidate_commit === fresh.candidate_commit, 'STALE_ACCEPTANCE', '验收页面版本与候选不一致');
      const bundle = JSON.parse(await (await import('node:fs/promises')).readFile(join(build.archive, 'requirements', `${req.requirement_id}.json`), 'utf8'));
      const criteria = bundle.manifest.acceptance_criteria;
      await this.gitlab.validatePrd(project, bundle.manifest.prd);
      requireThat(Array.isArray(input.results) && input.results.length === criteria.length && new Set(input.results.map(r => r.id)).size === criteria.length,
        'INCOMPLETE_ACCEPTANCE', '须逐项确认全部验收条件');
      for (const result of input.results) {
        requireThat(criteria.includes(result.id) && result.passed === true, 'INCOMPLETE_ACCEPTANCE', '存在未通过或未知验收条件');
        if (result.reused_from) {
          const prior = this.store.get('snapshots', result.reused_from);
          requireThat(prior.project_id === project.id && prior.requirement_key === req.id && prior.results.some(r => r.id === result.id && r.passed)
            && typeof result.reason === 'string' && result.reason.trim(), 'INVALID_REUSE', '沿用确认须指向本需求已有通过项并说明适用性');
        }
      }
      const retained = input.retained_deliveries || [];
      requireThat(Array.isArray(retained) && new Set(retained.map(item => item.snapshot_id)).size === retained.length, 'INVALID_RETENTION', '随本次交付关联重复或无效');
      for (const item of retained) {
        const prior = this.store.get('snapshots', item.snapshot_id);
        const priorMerge = this.store.list('merges', project.id).find(m => m.snapshot_id === prior.id);
        requireThat(prior.project_id === project.id && priorMerge && item.reason?.trim() &&
          await this.projects.repoFor(project).ancestor(prior.candidate_commit, fresh.candidate_commit),
          'INVALID_RETENTION', '只能确认本候选已包含且已有独立验收与合并依据的交付');
      }
      const id = fresh.acceptance_draft?.id || uid('snap'), record = fresh.acceptance_draft || { id, snapshot_id: id, project_id: project.id, workspace_id: project.workspace_id,
        requirement_id: req.requirement_id, requirement_key: req.id, change_id: fresh.change_id,
        attempt_id: fresh.id, candidate_commit: fresh.candidate_commit, source_head_sha: fresh.source_head_sha,
        target_main_sha: fresh.target_main_sha, build_id: build.id, artifact_sha256: build.artifact_sha256,
        prd: bundle.manifest.prd, prototype_config_digest: build.prototype_config_digest,
        requirement_package_digest: build.requirement_package_digest, sdk_version: build.sdk_version,
        reviewer: actor.id, confirmed_at: now(), results: input.results, retained_deliveries: retained };
      requireThat(this.gitlab, 'ACCEPTANCE_STORE_UNAVAILABLE', '未配置受控需求资料仓库');
      if (fresh.acceptance_draft) requireThat(digest(record.results) === digest(input.results) && digest(record.retained_deliveries || []) === digest(retained) && record.reviewer === actor.id, 'ACCEPTANCE_RETRY_CHANGED', '保存中的确认只允许原确认者以相同内容重试');
      else this.store.update('attempts', attemptId, { acceptance_draft: record });
      const evidence = await this.gitlab.commitAcceptance(project, record);
      const snapshot = this.store.insert('snapshots', { ...record, evidence });
      this.store.update('attempts', attemptId, { status: 'approved', snapshot_id: id });
      this.store.event(project.id, actor.id, 'acceptance.approved', id);
      return snapshot;
    });
  }
  reject(actor, attemptId, reason) {
    const attempt=this.store.get('attempts',attemptId);
    this.projects.authorize(actor,attempt.project_id,'reviewer');
    requireThat(actor.kind==='human'&&attempt.status==='awaiting_acceptance'&&reason?.trim(),'INVALID_REJECTION','人工驳回需待验收候选及具体原因');
    this.store.event(attempt.project_id,actor.id,'acceptance.rejected',attemptId,{reason,build_id:attempt.build_id});
    return this.store.update('attempts',attemptId,{status:'rejected',rejection_reason:reason,rejected_by:actor.id});
  }
  async recoverRelease(actor, releaseId, key) {
    const original = this.store.get('releases', releaseId), project = this.projects.authorize(actor, original.project_id, 'maintainer');
    requireThat(actor.kind === 'human' && original.status === 'published', 'RECOVERY_REQUIRED', '只能由人工恢复已成功发布的完整包');
    return this.projects.queue.run(project.id, async () => {
      const existing = this.store.list('releases', project.id).find(r => r.idempotency_key === key);
      if (existing) { requireThat(existing.recovery_of === releaseId, 'IDEMPOTENCY_CONFLICT', '恢复标识已占用'); return existing; }
      await this.artifacts.restore(original.build_id);
      return this.store.transaction(() => {
        const sequence = (this.store.get('projects', project.id).release_sequence || 0) + 1;
        const recovered = this.store.insert('releases', { id: uid('release'), project_id: project.id, build_id: original.build_id, snapshot_id: original.snapshot_id,
          recovery_of: original.id, status: 'published', sequence, idempotency_key: key, published_at: now(), actor: actor.id });
        this.store.update('projects', project.id, { current_release_id: recovered.id, release_sequence: sequence });
        this.store.event(project.id, actor.id, 'release.recovered', recovered.id);
        return recovered;
      });
    });
  }
  async merge(actor, attemptId) {
    const attempt = this.store.get('attempts', attemptId), project = this.projects.authorize(actor, attempt.project_id, 'maintainer');
    return this.projects.queue.run(project.id, async () => {
      const existing = this.store.list('merges', project.id).find(m => m.attempt_id === attemptId);
      if (existing) return existing;
      requireThat(attempt.status === 'approved' && attempt.snapshot_id, 'ACCEPTANCE_REQUIRED', '候选尚未人工确认');
      const snapshot = this.store.get('snapshots', attempt.snapshot_id);
      await this.artifacts.verify(snapshot.build_id);
      // Recover a successful GitLab side effect after a transport/DB interruption.
      const recovered = await this.gitlab?.mergedCandidate?.(project, attempt);
      if (recovered) {
        const record = this.store.insert('merges', { id: uid('merge'), project_id: project.id, attempt_id: attempt.id, snapshot_id: snapshot.id, ...recovered });
        this.store.event(project.id, actor.id, 'candidate.merge_reconciled', record.id);
        return record;
      }
      const repo = this.projects.repoFor(project); await repo.fetch();
      if (await repo.sha('main') !== attempt.target_main_sha) {
        this.store.update('attempts', attemptId, { status: 'stale' });
        requireThat(false, 'STALE_CANDIDATE', 'main 已变化，须重新集成和确认受影响内容');
      }
      requireThat(await repo.sha(`refs/heads/${attempt.branch}`) === attempt.candidate_commit, 'CANDIDATE_CHANGED', '冻结候选分支已变化');
      await repo.publishCandidate(attempt.branch);
      requireThat(this.gitlab, 'GITLAB_REQUIRED', '实际合并须通过 GitLab MR');
      const result = await this.gitlab.mergeCandidate(project, attempt);
      const record = this.store.insert('merges', { id: uid('merge'), project_id: project.id, attempt_id: attempt.id,
        snapshot_id: snapshot.id, ...result });
      this.store.event(project.id, actor.id, 'candidate.merged', record.id);
      return record;
    });
  }
  async release(actor, snapshotId, key) {
    const snapshot = this.store.get('snapshots', snapshotId), project = this.projects.authorize(actor, snapshot.project_id, 'maintainer');
    return this.projects.queue.run(project.id, async () => {
      const previous = this.store.list('releases', project.id).find(r => r.idempotency_key === key);
      if (previous?.status === 'published') return previous;
      requireThat(!previous || previous.snapshot_id === snapshotId, 'IDEMPOTENCY_CONFLICT', '请求标识已用于其他发布');
      requireThat(!previous?.superseded_by, 'SUPERSEDED', '该任务已由后续确认交付替代');
      const completed = this.store.list('releases', project.id).find(r => r.snapshot_id === snapshotId && r.status === 'published' && !r.recovery_of);
      if (completed) return completed;
      const merge = this.store.list('merges', project.id).find(m => m.snapshot_id === snapshotId);
      requireThat(merge && merge.merged_commit === snapshot.candidate_commit, 'MERGE_REQUIRED', '持续原型更新前必须合入已确认候选');
      const currentProject = this.store.get('projects', project.id);
      if (currentProject.current_release_id && !previous) {
        const displayed = this.store.get('releases', currentProject.current_release_id);
        const currentSnapshot = this.store.get('snapshots', displayed.snapshot_id);
        const repo = this.projects.repoFor(project);
        requireThat(await repo.ancestor(currentSnapshot.candidate_commit, snapshot.candidate_commit), 'SUPERSEDED', '较旧候选不能覆盖当前展示；恢复旧版本须使用显式恢复入口');
      }
      const sequence = previous?.sequence || (currentProject.release_sequence || 0) + 1;
      requireThat(!previous || sequence === currentProject.release_sequence, 'SUPERSEDED', '旧发布任务已被后续展示决定替代');
      if (!previous) this.store.update('projects', project.id, { release_sequence: sequence });
      const release = previous || this.store.insert('releases', { id: uid('release'), project_id: project.id, snapshot_id: snapshotId,
        build_id: snapshot.build_id, merge_id: merge.id, sequence, status: 'pending', idempotency_key: key });
      try {
        await this.artifacts.restore(snapshot.build_id);
        // The durable DB pointer is the atomic publication decision. Static URLs use immutable build IDs.
        this.store.transaction(() => {
          this.store.update('projects', project.id, { current_release_id: release.id });
          this.store.update('releases', release.id, { status: 'published', published_at: now() });
          this.store.insert('deliveries', { id: uid('delivery'), project_id: project.id, change_id: snapshot.change_id,
            snapshot_id: snapshot.id, merge_id: merge.id, release_id: release.id, build_id: snapshot.build_id });
          this.store.update('changes', snapshot.change_id, { status: 'delivered' });
          for (const item of snapshot.retained_deliveries || []) {
            const prior = this.store.get('snapshots', item.snapshot_id);
            const priorMerge = this.store.list('merges', project.id).find(m => m.snapshot_id === prior.id);
            this.store.insert('deliveries', { id: uid('delivery'), project_id: project.id, change_id: prior.change_id,
              snapshot_id: prior.id, merge_id: priorMerge.id, release_id: release.id, build_id: snapshot.build_id,
              delivered_with_snapshot: snapshot.id, retention_reason: item.reason });
            this.store.update('changes', prior.change_id, { status: 'delivered' });
            for (const failed of this.store.list('releases', project.id).filter(r => r.snapshot_id === prior.id && r.status !== 'published'))
              this.store.update('releases', failed.id, { superseded_by: release.id });
          }
        });
        this.store.event(project.id, actor.id, 'release.published', release.id);
        return this.store.get('releases', release.id);
      } catch (error) { this.store.update('releases', release.id, { status: 'failed', error: error.message }); throw error; }
    });
  }
}
