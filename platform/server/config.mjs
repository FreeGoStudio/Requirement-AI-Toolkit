import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { requireThat } from './errors.mjs';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const prototypeSchema = z.object({
  schema_version: z.literal(1), workspace_id: slug, project_id: slug,
  repository: z.object({ default_branch: z.literal('main') }),
  applications: z.array(z.object({ id: slug, name: z.string().min(1), root: z.string().min(1),
    build_command: z.string().min(1), output: z.string().min(1), entry: z.string().startsWith('/'),
    screens: z.array(z.object({ route: z.string().startsWith('/'), story_id: z.string().regex(/^[a-z0-9_-]+--[a-z0-9_-]+$/) })).min(1)
  })).min(1)
});
export function within(root, child) {
  requireThat(typeof child === 'string' && !isAbsolute(child) && !child.includes('\\') && !child.split('/').includes('..'), 'INVALID_PATH', '路径必须位于项目目录', 400);
  const path = resolve(root, child), rel = relative(resolve(root), path);
  requireThat(rel && !rel.startsWith('..') && !isAbsolute(rel), 'INVALID_PATH', '路径逃逸项目目录', 400);
  return path;
}
export async function existingWithin(root, child) {
  const path = await realpath(within(root, child));
  const base = await realpath(root), rel = relative(base, path);
  requireThat(rel && !rel.startsWith('..') && !isAbsolute(rel), 'INVALID_PATH', '符号链接逃逸项目目录');
  return path;
}
export function validatePrototype(value, project) {
  const config = prototypeSchema.parse(value), ids = new Set();
  requireThat(config.project_id === project.id && config.workspace_id === project.workspace_id, 'PROJECT_MISMATCH', '原型配置与注册项目不一致');
  for (const app of config.applications) {
    requireThat(!ids.has(app.id), 'DUPLICATE_APP', '应用 ID 重复'); ids.add(app.id);
    within('/project', app.root); within('/project', app.output);
    const routes = app.screens.map(screen => screen.route);
    requireThat(new Set(routes).size === routes.length && routes.includes(app.entry), 'INVALID_SCREEN', '路由重复或入口未登记');
  }
  return config;
}
export async function loadPrototype(root, project) {
  return validatePrototype(YAML.parse(await readFile(resolve(root, 'prototype.yaml'), 'utf8')), project);
}
