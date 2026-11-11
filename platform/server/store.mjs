import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireThat } from './errors.mjs';

const tables = new Set(['workspaces', 'projects', 'requirements', 'changes', 'attempts', 'syncs',
  'builds', 'previews', 'snapshots', 'merges', 'releases', 'deliveries', 'operations', 'events', 'users', 'sessions']);
const immutable = new Set(['snapshots', 'merges', 'deliveries', 'events']);
export const uid = prefix => `${prefix}-${randomUUID()}`;
export const now = () => new Date().toISOString();

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    for (const table of tables) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table}
      (id TEXT PRIMARY KEY, project_id TEXT, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX IF NOT EXISTS ${table}_project ON ${table}(project_id);`);
  }
  table(table) { requireThat(tables.has(table), 'INVALID_TABLE', '未知记录类型'); return table; }
  get(table, id, required = true) {
    const row = this.db.prepare(`SELECT data,revision FROM ${this.table(table)} WHERE id=?`).get(id);
    requireThat(row || !required, 'NOT_FOUND', '记录不存在', 404);
    return row ? { ...JSON.parse(row.data), revision: row.revision } : null;
  }
  list(table, projectId) {
    const rows = projectId === undefined
      ? this.db.prepare(`SELECT data,revision FROM ${this.table(table)}`).all()
      : this.db.prepare(`SELECT data,revision FROM ${this.table(table)} WHERE project_id=?`).all(projectId);
    return rows.map(row => ({ ...JSON.parse(row.data), revision: row.revision }));
  }
  insert(table, value) {
    this.db.prepare(`INSERT INTO ${this.table(table)} (id,project_id,data) VALUES (?,?,?)`)
      .run(value.id, value.project_id ?? null, JSON.stringify({ created_at: now(), ...value }));
    return this.get(table, value.id);
  }
  update(table, id, patch, revision) {
    requireThat(!immutable.has(table), 'IMMUTABLE', '历史事实不可覆盖');
    const old = this.get(table, id);
    const { revision: ignored, ...data } = { ...old, ...patch, id, updated_at: now() };
    const result = this.db.prepare(`UPDATE ${this.table(table)} SET data=?,revision=revision+1 WHERE id=? AND revision=?`)
      .run(JSON.stringify(data), id, revision ?? old.revision);
    requireThat(result.changes === 1, 'CONCURRENT_CHANGE', '记录已变化，请刷新后重试');
    return this.get(table, id);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  event(projectId, actor, type, target, data = {}) {
    return this.insert('events', { id: uid('event'), project_id: projectId, actor, type, target, data });
  }
  close() { this.db.close(); }
}

// One service process owns the database and Git operations. Multi-instance deployment
// requires a shared distributed lock; it must not silently bypass this serial queue.
export class SerialQueue {
  tails = new Map();
  async run(key, fn) {
    const previous = this.tails.get(key) || Promise.resolve();
    let release;
    const next = new Promise(resolve => { release = resolve; });
    this.tails.set(key, next);
    await previous;
    try { return await fn(); }
    finally { release(); if (this.tails.get(key) === next) this.tails.delete(key); }
  }
}
