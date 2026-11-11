// Plane remains authoritative for business state; prototype delivery never marks
// a Plane issue Done. Reconciliation is idempotent and can resume after restart.
export async function reconcilePlane({ store, projects, plane }, actor, projectId) {
  const project = projects.authorize(actor, projectId, 'developer');
  if (!plane || !project.plane_project_id) return { records: [] };
  const items = await plane.workItems(project.plane_workspace_slug || project.workspace_id, project.plane_project_id);
  const records = [];
  for (const item of items) {
    const old = store.list('requirements', projectId).find(r => r.plane_id === item.id);
    const record = old || await projects.createRequirement(actor, projectId, {
      requirement_id: `req${item.sequence_id || item.id.replaceAll('-', '')}`,
      title: item.name, plane_id: item.id, idempotency_key: `plane:${item.id}`
    });
    if (record.title !== item.name || record.plane_updated_at !== item.updated_at)
      records.push(store.update('requirements', record.id, { title: item.name, plane_state: item.state, plane_updated_at: item.updated_at }));
    else records.push(record);
  }
  return { records };
}
export function startPlanePolling(services, intervalMs = 60000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const project of services.store.list('projects').filter(p => p.plane_project_id)) {
        const actor = { id: 'plane-reconciler', kind: 'agent', projects: { [project.id]: 'developer' } };
        try { await reconcilePlane(services, actor, project.id); }
        catch (error) { services.store.event(project.id, actor.id, 'plane.reconciliation_failed', project.id, { error: error.message }); }
      }
    } finally { running = false; }
  };
  const timer = setInterval(tick, Math.max(intervalMs,10000)); timer.unref();
  void tick();
  return () => clearInterval(timer);
}
