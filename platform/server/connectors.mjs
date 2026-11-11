import { requireThat, PlatformError } from './errors.mjs';

export class GitLab {
  constructor(base, token) { this.base = base.replace(/\/$/, ''); this.token = token; }
  async request(path, method = 'GET', body) {
    const response = await fetch(`${this.base}/api/v4${path}`, { method,
      headers: { 'PRIVATE-TOKEN': this.token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    if (!response.ok) throw new PlatformError('GITLAB_ERROR', `GitLab ${method} ${path}: HTTP ${response.status}`, 502);
    return text ? JSON.parse(text) : null;
  }
  async validateProject(id) {
    const project = await this.request(`/projects/${id}`);
    requireThat(project.merge_method === 'ff' && project.squash_option === 'never', 'GITLAB_POLICY', '项目须启用 fast-forward 且禁用 squash');
    const branches = await this.request(`/projects/${id}/protected_branches`);
    const main = branches.find(branch => branch.name === 'main');
    requireThat(main && main.push_access_levels.every(level => level.access_level === 0), 'GITLAB_POLICY', 'main 必须禁止直接推送');
    return project;
  }
  async mergeCandidate(project, attempt) {
    await this.validateProject(project.gitlab_project_id);
    const prefix = `/projects/${project.gitlab_project_id}`;
    const target = await this.request(`${prefix}/repository/branches/main`);
    requireThat(target.commit.id === attempt.target_main_sha, 'STALE_CANDIDATE', 'main 已偏离候选基线');
    let mr;
    const existing = await this.request(`${prefix}/merge_requests?source_branch=${encodeURIComponent(attempt.branch)}&state=opened`);
    mr = existing[0] || await this.request(`${prefix}/merge_requests`, 'POST', {
      source_branch: attempt.branch, target_branch: 'main', title: `原型交付 ${attempt.requirement_key}`,
      remove_source_branch: false, squash: false
    });
    // GitLab can return checking/unchecked briefly. No automatic rebase or squash.
    for (let index = 0; index < 20; index++) {
      mr = await this.request(`${prefix}/merge_requests/${mr.iid}?with_merge_status_recheck=true`);
      if (mr.detailed_merge_status === 'mergeable') break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    requireThat(mr.sha === attempt.candidate_commit, 'CANDIDATE_CHANGED', 'MR 源提交与验收候选不同');
    const latest = await this.request(`${prefix}/repository/branches/main`);
    requireThat(latest.commit.id === attempt.target_main_sha, 'STALE_CANDIDATE', 'main 已偏离候选基线');
    const result = await this.request(`${prefix}/merge_requests/${mr.iid}/merge`, 'PUT', {
      sha: attempt.candidate_commit, squash: false, should_remove_source_branch: false
    });
    requireThat(result.state === 'merged', 'MERGE_PENDING', 'GitLab 未确认已合并');
    const after = await this.request(`${prefix}/repository/branches/main`);
    requireThat(after.commit.id === attempt.candidate_commit, 'MERGE_SHA_MISMATCH', '实际合并结果与候选不一致');
    return { mr_iid: mr.iid, gitlab_project_id: project.gitlab_project_id,
      merged_commit: after.commit.id, merged_at: result.merged_at, web_url: result.web_url };
  }
  async commitAcceptance(project, record) {
    const path = `requirements/${record.requirement_id}/acceptance-records/${record.id}.json`;
    const prefix = `/projects/${project.requirements_gitlab_id}`;
    const existing = await fetch(`${this.base}/api/v4${prefix}/repository/files/${encodeURIComponent(path)}?ref=main`, {
      headers: { 'PRIVATE-TOKEN': this.token }, signal: AbortSignal.timeout(30000) });
    if (existing.ok) {
      const file = await existing.json();
      requireThat(Buffer.from(file.content, 'base64').toString() === JSON.stringify(record, null, 2), 'IMMUTABLE', '验收记录已经存在且内容不同');
      return { path, commit: file.last_commit_id };
    }
    requireThat(existing.status === 404, 'GITLAB_ERROR', '无法核验验收记录是否已存在');
    const commit = await this.request(`${prefix}/repository/commits`, 'POST', {
      branch: 'main', commit_message: `Record prototype acceptance ${record.id}`,
      actions: [{ action: 'create', file_path: path, content: JSON.stringify(record, null, 2) }]
    });
    return { path, commit: commit.id };
  }
}

export class Plane {
  constructor(base, apiKey) { this.base = base.replace(/\/$/, ''); this.apiKey = apiKey; }
  async request(path) {
    const response = await fetch(`${this.base}/api/v1${path}`, {
      headers: { 'X-API-Key': this.apiKey }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new PlatformError('PLANE_ERROR', `Plane HTTP ${response.status}`, 502);
    return response.json();
  }
  async workItems(workspace, projectId) {
    const prefix = `/workspaces/${encodeURIComponent(workspace)}/projects/${encodeURIComponent(projectId)}/work-items/`;
    const items = []; let cursor;
    do {
      const page = await this.request(`${prefix}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      items.push(...(Array.isArray(page) ? page : page.results || []));
      const next = page.next_page_results ? page.next_cursor : null;
      requireThat(!next || next !== cursor, 'PLANE_PAGINATION', 'Plane 分页游标未推进');
      cursor = next;
    } while (cursor);
    return items;
  }
}
