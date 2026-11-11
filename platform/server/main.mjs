import express from 'express';
import { readFile, mkdir, access } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Store, uid } from './store.mjs';
import { GitRepository } from './git.mjs';
import { ProjectService } from './projects.mjs';
import { Artifacts } from './artifacts.mjs';
import { DockerRunner } from './runner.mjs';
import { DeliveryService } from './delivery.mjs';
import { GitLab, Plane } from './connectors.mjs';
import { Auth, passwordHash } from './auth.mjs';
import { requireThat } from './errors.mjs';
import { reconcilePlane, startPlanePolling } from './plane-sync.mjs';
import { provisionProject } from './provision.mjs';
import { ConflictAssistant, conflictProvider } from './conflict-assistant.mjs';
import { codexProvider } from './codex-provider.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function createApp({ store, projects, delivery, artifacts, auth, config, plane, gitlab, assistant }) {
  const app = express(); app.disable('x-powered-by'); app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin');
    res.set('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'");
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    req.session = auth.session(req); req.actor = req.session?.user;
    next();
  });
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/login', (req, res) => {
    requireThat(!req.headers.origin || req.headers.origin === config.public_url, 'ORIGIN', '请求来源不匹配', 403);
    const result = auth.login(req.body.username, req.body.password);
    res.cookie('prototype_session', result.token, { httpOnly: true, sameSite: 'strict', secure: config.public_url.startsWith('https:'), maxAge: 8 * 3600000 });
    res.json({ user: result.user, csrf: result.csrf, artifact_url: config.artifact_url || `http://127.0.0.1:${config.artifact_port || 3078}` });
  });
  app.use('/api', (req, res, next) => {
    requireThat(req.actor, 'UNAUTHORIZED', '请先登录', 401);
    if (req.method !== 'GET') {
      requireThat(req.headers['x-csrf-token'] === req.session.csrf && (!req.headers.origin || req.headers.origin === config.public_url), 'CSRF', '会话校验失败', 403);
      requireThat(req.headers['idempotency-key'] || req.path === '/logout', 'IDEMPOTENCY_REQUIRED', '操作需要请求标识', 400);
    }
    next();
  });
  app.get('/api/me', (req, res) => res.json({ user: req.actor, csrf: req.session.csrf, artifact_url: config.artifact_url || `http://127.0.0.1:${config.artifact_port || 3078}` }));
  app.post('/api/logout', (req, res) => { store.update('sessions', req.session.id, { expires_at: 0 }); res.clearCookie('prototype_session'); res.json({ ok: true }); });
  app.get('/api/workspaces', (req, res) => res.json(store.list('workspaces').filter(w => req.actor.workspaces?.[w.id] || store.list('projects').some(p => p.workspace_id === w.id && req.actor.projects?.[p.id]))));
  app.post('/api/projects', async (req,res) => res.status(201).json(await provisionProject({store,projects,gitlab,config,dataRoot:resolve(config.data_dir),template:join(root,'platform/templates/prototype')},req.actor,req.body,req.headers['idempotency-key'])));
  app.get('/api/workspaces/:workspaceId/projects', (req, res) => {
    res.json(store.list('projects').filter(p => p.workspace_id === req.params.workspaceId).filter(p => { try { projects.authorize(req.actor, p.id); return true; } catch { return false; } }).map(({ repo_path, ...p }) => p));
  });
  app.get('/api/projects/:projectId', (req, res) => {
    const project = projects.authorize(req.actor, req.params.projectId);
    const allowed = ['requirements','changes','attempts','syncs','builds','previews','snapshots','merges','releases','deliveries','events'];
    const data = Object.fromEntries(allowed.map(table => [table, store.list(table, project.id).map(({ workdir, archive, ...record }) => record)]));
    const { repo_path, ...publicProject } = project;
    res.json({ project: publicProject, ...data });
  });
  app.post('/api/projects/:projectId/requirements', async (req, res) => res.status(201).json(await projects.createRequirement(req.actor, req.params.projectId, { ...req.body, idempotency_key: req.headers['idempotency-key'] })));
  app.post('/api/projects/:projectId/requirements/sync', async (req, res) => {
    const project = projects.authorize(req.actor, req.params.projectId, 'developer');
    requireThat(plane && project.plane_project_id, 'PLANE_NOT_CONFIGURED', '尚未配置 Plane 项目');
    res.json(await reconcilePlane({store,projects,plane},req.actor,project.id));
  });
  app.post('/api/projects/:projectId/requirements/:reqId/integrations', async (req, res) => {
    const record=await projects.createIntegration(req.actor, req.params.projectId, req.params.reqId, { idempotency_key: req.headers['idempotency-key'] });
    res.json(assistant?await assistant.run('attempts',record):record);
  });
  app.post('/api/projects/:projectId/requirements/:reqId/base-syncs', async (req, res) => {
    const record=await projects.startSync(req.actor, req.params.projectId, req.params.reqId, { target: req.body.target, idempotency_key: req.headers['idempotency-key'] });
    res.json(assistant?await assistant.run('syncs',record):record);
  });
  app.post('/api/base-syncs/:id/verify', async (req, res) => res.json(await delivery.verifySync(req.actor, req.params.id)));
  app.post('/api/base-syncs/:id/confirm', async (req, res) => res.json(await delivery.confirmSync(req.actor, req.params.id, req.body.build_id)));
  app.get('/api/conflicts/:table/:id', async (req, res) => res.json(await projects.conflictFiles(req.actor, req.params.table, req.params.id)));
  app.post('/api/conflicts/:table/:id', async (req, res) => res.json(await projects.resolveConflicts(req.actor, req.params.table, req.params.id, req.body)));
  app.post('/api/attempts/:table/:id/cancel', (req, res) => res.json(projects.stopAttempt(req.actor, req.params.table, req.params.id, req.body.reason)));
  app.post('/api/projects/:projectId/requirements/:reqId/document-completion', async (req,res) => {
    const project=projects.authorize(req.actor,req.params.projectId,'reviewer');
    await gitlab.validatePrd(project,req.body.evidence);
    res.json(projects.completeDocumentChange(req.actor,req.params.projectId,req.params.reqId,req.body.evidence));
  });
  app.post('/api/projects/:projectId/requirements/:reqId/builds', async (req, res) => res.json(await delivery.build(req.actor, req.params.projectId, req.params.reqId, { attempt_id: req.body.attempt_id, history_ref: req.body.history_ref, idempotency_key: req.headers['idempotency-key'] })));
  app.post('/api/projects/:projectId/requirements/:reqId/preview-publications', async (req, res) => res.json(await delivery.publishPreview(req.actor, req.params.projectId, req.params.reqId, req.body.build_id, req.headers['idempotency-key'])));
  app.post('/api/integrations/:id/acceptance', async (req, res) => res.json(await delivery.accept(req.actor, req.params.id, req.body)));
  app.post('/api/integrations/:id/rejection', (req,res) => res.json(delivery.reject(req.actor,req.params.id,req.body.reason)));
  app.get('/api/integrations/:id/criteria', async (req, res) => {
    const attempt = store.get('attempts', req.params.id); projects.authorize(req.actor, attempt.project_id);
    const build = await artifacts.verify(attempt.build_id);
    const bundle = JSON.parse(await readFile(join(build.archive, 'requirements', `${build.requirement_id}.json`), 'utf8'));
    res.json({ criteria: bundle.manifest.acceptance_criteria });
  });
  app.post('/api/integrations/:id/merge', async (req, res) => res.json(await delivery.merge(req.actor, req.params.id)));
  app.post('/api/snapshots/:id/releases', async (req, res) => res.json(await delivery.release(req.actor, req.params.id, req.headers['idempotency-key'])));
  app.post('/api/releases/:id/recovery', async (req,res) => res.json(await delivery.recoverRelease(req.actor, req.params.id, req.headers['idempotency-key'])));
  app.post('/api/snapshots/:id/restore', async (req, res) => {
    const snapshot = store.get('snapshots', req.params.id); projects.authorize(req.actor, snapshot.project_id);
    await projects.queue.run(`restore:${snapshot.build_id}`, () => artifacts.restore(snapshot.build_id));
    res.json({ url: `/artifacts/${snapshot.build_id}/index.html` });
  });
  app.get('/api/projects/:projectId/requirements/:reqId/views', (req, res) => {
    const project = projects.authorize(req.actor, req.params.projectId), reqRecord = store.get('requirements', `${project.id}/${req.params.reqId}`);
    const preview = reqRecord.preview_id ? store.get('previews', reqRecord.preview_id) : null;
    const current = project.current_release_id ? store.get('releases', project.current_release_id) : null;
    res.json({ preview, current, snapshots: store.list('snapshots', project.id).filter(s => s.requirement_key === reqRecord.id) });
  });
  app.use(express.static(join(root, 'platform/web/dist')));
  app.get('/', (req, res) => res.sendFile(join(root, 'platform/web/dist/index.html')));
  app.use((error, req, res, next) => {
    res.status(error.status || (error.name === 'ZodError' ? 400 : 500)).json({ error: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : '操作失败，请检查服务日志' });
  });
  return app;
}

export function createArtifactApp({ store, projects, artifacts, auth }) {
  const app = express(); app.disable('x-powered-by');
  const verifiedFolders = new Map();
  app.get('/projects/:projectId/current', (req,res) => {
    const project = projects.authorize(auth.session(req)?.user, req.params.projectId);
    requireThat(project.current_release_id, 'NO_RELEASE', '项目尚无成功发布', 404);
    const release = store.get('releases', project.current_release_id);
    res.set('Cache-Control','no-store').redirect(`/artifacts/${release.build_id}/index.html#review=false`);
  });
  app.get('/projects/:projectId/requirements/:reqId', (req,res) => {
    const project = projects.authorize(auth.session(req)?.user, req.params.projectId);
    const requirement = store.get('requirements', `${project.id}/${req.params.reqId}`);
    requireThat(requirement.preview_id, 'NO_PREVIEW', '需求尚无成功预览', 404);
    const preview = store.get('previews', requirement.preview_id);
    res.set('Cache-Control','no-store').redirect(`/artifacts/${preview.build_id}/index.html`);
  });
  // A separate origin prevents candidate code from reading approval API sessions/CSRF.
  // Cookies are HttpOnly; mutation APIs additionally require their own same-origin CSRF.
  app.use('/artifacts/:buildId', async (req, res, next) => {
    try {
      const build = store.get('builds', req.params.buildId);
      projects.authorize(auth.session(req)?.user, build.project_id);
      let folder = verifiedFolders.get(build.id);
      if (folder) { try { await access(folder); } catch { folder = null; } }
      if (!folder || req.path === '/index.html') {
        folder = await projects.queue.run(`restore:${build.id}`, () => artifacts.restore(build.id));
        verifiedFolders.set(build.id, folder);
      }
      res.set('Cache-Control', 'private, no-cache');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; object-src 'none'");
      express.static(folder, { dotfiles: 'deny', fallthrough: false })(req, res, next);
    } catch (error) { next(error); }
  });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code || 'ARTIFACT_ERROR', message: error.status ? error.message : '产物无法访问' }));
  return app;
}

export async function start(configPath = process.env.PLATFORM_CONFIG || join(root, 'platform/config.local.json')) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const data = resolve(config.data_dir || join(root, 'platform/.local'));
  const store = new Store(join(data, 'platform.sqlite'));
  const repositories = new Map();
  const projects = new ProjectService(store, project => {
    if (!repositories.has(project.id)) repositories.set(project.id, new GitRepository(project.repo_path, { remote: true, token: config.gitlab_token }));
    return repositories.get(project.id);
  }, join(data, 'worktrees'));
  const artifacts = new Artifacts(store, join(data, 'artifacts'));
  const runner = new DockerRunner({ image: config.runner_image, outputRoot: join(data, 'runner-output') });
  const gitlab = new GitLab(config.gitlab_url, config.gitlab_token), auth = new Auth(store);
  const delivery = new DeliveryService(projects, artifacts, runner, gitlab, { executablePath: config.browser_executable });
  const plane = config.plane_token ? new Plane(config.plane_url, config.plane_token) : null;
  const assistant=new ConflictAssistant(projects,codexProvider(config.conflict_service,data)||conflictProvider(config.conflict_service),{timeoutMs:config.conflict_service?.timeout_ms || 60000});
  const app = createApp({ store, projects, delivery, artifacts, auth, config, plane, gitlab, assistant });
  const server = app.listen(config.port || 3077, '127.0.0.1', () => {
    for(const operation of store.list('operations').filter(o=>o.status==='running')) store.update('operations',operation.id,{status:'failed',error:'服务重启中断；可使用原请求标识重试冻结来源'});
    console.log(`Prototype platform: ${config.public_url}`);
  });
  const artifactServer = createArtifactApp({ store, projects, artifacts, auth }).listen(config.artifact_port || 3078, '127.0.0.1');
  const stopPolling = plane && config.plane_polling !== false ? startPlanePolling({store,projects,plane},config.plane_poll_ms) : () => {};
  return { server, artifactServer, app, store, projects, artifacts, delivery, auth, config, stopPolling };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await start();
