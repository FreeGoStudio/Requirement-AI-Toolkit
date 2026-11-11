import { mkdir, readFile, writeFile, readdir, lstat, cp, rename, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { uid } from './store.mjs';
import { requireThat } from './errors.mjs';
import { existingWithin, within } from './config.mjs';

export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export async function inventory(root, dir = root) {
  const files = {};
  for (const name of (await readdir(dir)).sort()) {
    const path = join(dir, name), stat = await lstat(path);
    requireThat(!stat.isSymbolicLink(), 'UNSAFE_ARTIFACT', '产物不允许符号链接');
    if (stat.isDirectory()) Object.assign(files, await inventory(root, path));
    else if (stat.isFile()) files[relative(root, path).replaceAll('\\', '/')] = digest(await readFile(path));
    else requireThat(false, 'UNSAFE_ARTIFACT', '产物包含不支持的文件类型');
  }
  return files;
}
export async function requirementPackage(root, reqId, config) {
  const folder = await existingWithin(root, `requirements/${reqId}`);
  const parse = async path => YAML.parse(await readFile(await existingWithin(folder, path), 'utf8'));
  const manifest = await parse('manifest.yaml');
  requireThat(manifest.schema_version === 1 && manifest.requirement_id === reqId, 'INVALID_PACKAGE', '需求包身份不匹配');
  const annotations = await parse(manifest.annotations), scenarios = await parse(manifest.scenarios), walkthrough = await parse(manifest.walkthrough);
  const apps = new Map(config.applications.map(app => [app.id, app]));
  const scopes = new Map(), criteria = new Set(manifest.acceptance_criteria), covered = new Set();
  const routeExists = (app, route) => apps.get(app)?.screens.some(screen => screen.route === route);
  requireThat(criteria.size > 0 && criteria.size === manifest.acceptance_criteria.length, 'INVALID_CRITERIA', '验收条件缺失或重复');
  requireThat(manifest.affected_apps?.length && manifest.affected_apps.every(id => apps.has(id)), 'INVALID_APP', '影响应用不存在');
  for (const scope of manifest.review_scope || []) {
    requireThat(!scopes.has(scope.id) && routeExists(scope.app, scope.route), 'INVALID_SCOPE', '评审范围重复或页面不存在');
    requireThat(['focus', 'context'].includes(scope.role) && (!!scope.whole_page !== !!scope.regions?.length), 'INVALID_SCOPE', '评审范围需声明区域或整页');
    for (const ac of scope.acceptance_criteria || []) {
      requireThat(criteria.has(ac), 'INVALID_CRITERIA', '范围引用了未知验收条件');
      if (scope.role === 'focus') covered.add(ac);
    }
    scopes.set(scope.id, scope);
  }
  for (const ac of criteria) requireThat(covered.has(ac) || manifest.nonvisual_acceptance?.[ac], 'UNCOVERED_CRITERIA', `验收条件 ${ac} 缺少重点页面或非页面验证说明`);
  const annotationIds = new Set();
  for (const note of annotations.annotations || []) {
    const scope = scopes.get(note.scope_id);
    requireThat(!annotationIds.has(note.id) && scope && ['element','note','walkthrough','change'].includes(note.type), 'INVALID_ANNOTATION', '标注重复、类型无效或范围缺失');
    annotationIds.add(note.id);
    if (note.type !== 'note' || note.target) requireThat(note.target?.app === scope.app && note.target.route === scope.route && note.target.element_id, 'ANNOTATION_OUTSIDE_SCOPE', '标注目标不在本需求范围');
    for (const ac of note.acceptance_criteria || []) requireThat(criteria.has(ac), 'INVALID_CRITERIA', '标注引用了未知验收条件');
  }
  const sceneIds = new Set();
  for (const scene of scenarios.scenarios || []) {
    requireThat(!sceneIds.has(scene.id) && Object.keys(scene.app_states || {}).every(id => apps.has(id)), 'INVALID_SCENARIO', '场景重复或引用未知应用');
    sceneIds.add(scene.id);
  }
  requireThat(sceneIds.size > 0, 'INVALID_SCENARIO', '缺少初始场景');
  const stepIds = new Set();
  for (const step of walkthrough.steps || []) {
    requireThat(!stepIds.has(step.id), 'INVALID_STEP', '演示步骤重复'); stepIds.add(step.id);
    requireThat(['select_scenario','navigate','highlight'].includes(step.action), 'INVALID_ACTION', '不支持的演示动作');
    if (step.action === 'select_scenario') requireThat(sceneIds.has(step.scenario), 'INVALID_SCENARIO', '步骤场景不存在');
    else requireThat(routeExists(step.app, step.route), 'INVALID_STEP', '步骤页面不存在');
    if (step.annotation) requireThat(annotationIds.has(step.annotation), 'INVALID_STEP', '步骤标注不存在');
  }
  return { manifest, annotations, scenarios, walkthrough };
}

export class Artifacts {
  constructor(store, root) { this.store = store; this.root = root; }
  async collect(project, source, config, reqId, provenance) {
    const bundle = await requirementPackage(source, reqId, config), id = uid('build');
    const stage = join(this.root, 'staging', id), archive = join(this.root, 'archives', id);
    await mkdir(stage, { recursive: true });
    for (const app of config.applications) {
      const output = await existingWithin(source, app.output);
      const index = JSON.parse(await readFile(join(output, 'index.json'), 'utf8'));
      for (const screen of app.screens) requireThat(index.entries?.[screen.story_id]?.type === 'story', 'MISSING_STORY', `Story 不存在：${app.id}/${screen.story_id}`);
      await access(join(output, 'iframe.html')); await access(join(output, 'index.html'));
      await inventory(output); await cp(output, join(stage, 'apps', app.id), { recursive: true, errorOnExist: true });
    }
    // Player and SDK must come from the same frozen source, never a global latest copy.
    const player = await existingWithin(source, 'packages/prototype-player/dist');
    await inventory(player); await cp(player, stage, { recursive: true });
    await access(join(stage, 'index.html'));
    await mkdir(join(stage, 'requirements'), { recursive: true });
    const sourceRequirements = await existingWithin(source, 'requirements');
    await inventory(sourceRequirements);
    await cp(sourceRequirements, join(stage, 'requirement-sources'), { recursive: true });
    for (const other of await readdir(sourceRequirements, { withFileTypes: true })) {
      if (!other.isDirectory() || other.name === reqId || !/^[a-z0-9]+$/.test(other.name)) continue;
      try {
        const folder = join(sourceRequirements, other.name);
        const read = async file => YAML.parse(await readFile(await existingWithin(folder, file), 'utf8'));
        const manifest = await read('manifest.yaml');
        const value = { manifest, annotations: await read(manifest.annotations), scenarios: await read(manifest.scenarios), walkthrough: await read(manifest.walkthrough) };
        await writeFile(join(stage, 'requirements', `${other.name}.json`), JSON.stringify(value));
      } catch {
        // A's annotation health does not gate B; keep A's source and a visible diagnostic.
        await writeFile(join(stage, 'requirements', `${other.name}.json`), JSON.stringify({ error: '该需求资料无法解析，请查看此固定版本中的原始需求包' }));
      }
    }
    await writeFile(join(stage, 'requirements', `${reqId}.json`), JSON.stringify(bundle));
    await writeFile(join(stage, 'prototype-config.json'), JSON.stringify(config));
    const manifest = { build_id: id, project_id: project.id, requirement_id: reqId, ...provenance,
      prototype_config_digest: digest(config), requirement_package_digest: digest(bundle), sdk_version: '1',
      files: await inventory(stage) };
    await writeFile(join(stage, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
    const hash = digest(await inventory(stage));
    await mkdir(join(this.root, 'archives'), { recursive: true });
    await rename(stage, archive);
    return this.store.insert('builds', { id, project_id: project.id, requirement_id: reqId,
      archive, artifact_sha256: hash, ...manifest, id, verified: true });
  }
  async verify(id) {
    const build = this.store.get('builds', id);
    requireThat(digest(await inventory(build.archive)) === build.artifact_sha256, 'CORRUPT_ARCHIVE', '归档摘要不匹配，不能用新版代替');
    return build;
  }
  async restore(id) {
    const build = await this.verify(id), cache = join(this.root, 'online', id);
    try {
      if (digest(await inventory(cache)) === build.artifact_sha256) return cache;
      await rename(cache, `${cache}-${uid('corrupt')}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const stage = join(this.root, 'online', `${id}-${uid('restore')}`);
    await mkdir(join(this.root, 'online'), { recursive: true });
    await cp(build.archive, stage, { recursive: true, errorOnExist: true });
    requireThat(digest(await inventory(stage)) === build.artifact_sha256, 'CORRUPT_COPY', '恢复副本摘要不一致');
    await rename(stage, cache);
    return cache;
  }
}
