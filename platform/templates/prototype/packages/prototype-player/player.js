const $ = selector => document.querySelector(selector);
const config = await (await fetch('prototype-config.json')).json();
const build = await (await fetch('build-manifest.json')).json();
const reqId = new URLSearchParams(location.search).get('requirement') || build.requirement_id;
if (!/^[a-z0-9]+$/.test(reqId)) throw new Error('无效需求编号');
const response = await fetch(`requirements/${reqId}.json`);
if (!response.ok) throw new Error('固定包中不存在本需求评审资料');
const bundle = await response.json();
if (bundle.error) { document.body.textContent = bundle.error; throw new Error(bundle.error); }
const scopes = bundle.manifest.review_scope, frame = $('#canvas'), dialog = $('#boundary');
let state = {}, current, review = true, pending, targetHighlight, context = crypto.randomUUID(), ready = false;
const routeMap = new Map(config.applications.flatMap(app => app.screens.map(screen => [`${app.id}:${screen.route}`, { app, screen }])));
$('#title').textContent = bundle.manifest.title;
$('#version').textContent = `固定版本 ${build.build_id}`;
const send = (type, payload) => frame.contentWindow.postMessage({ type, payload, app: current.app, context, requestId: crypto.randomUUID(), schemaVersion: 1 }, location.origin);
const report = text => { $('#status').textContent = text; };
function setMode(value) { review = value; $('#mode').textContent = review ? '需求评审' : '完整产品浏览'; $('#return').style.display = review ? 'none' : 'inline-block'; }
function allowed(target) { return scopes.some(scope => scope.app === target.app && scope.route === target.route && (!scope.states?.length || scope.states.includes(target.state))); }
function commitNavigation(target, replace = false) {
  if (target.external) { window.open(target.external, '_blank', 'noopener'); return; }
  const entry = routeMap.get(`${target.app}:${target.route}`);
  if (!entry) { report(`页面未登记：${target.app}${target.route}`); return; }
  if (target.newWindow) {
    const url = new URL(location.href); url.hash = new URLSearchParams({ app: target.app, route: target.route, review: String(review) });
    window.open(url, '_blank', 'noopener'); return;
  }
  current = target;
  const hash = new URLSearchParams({ app: target.app, route: target.route, review: String(review), ...(target.state ? { state: target.state } : {}) });
  history[replace ? 'replaceState' : 'pushState'](target, '', `#${hash}`);
  const src = new URL(`apps/${entry.app.id}/iframe.html?id=${encodeURIComponent(entry.screen.story_id)}&viewMode=story`, location.href);
  if (frame.src !== src.href) { context = crypto.randomUUID(); ready = false; frame.src = src.href; }
  else if (ready) send('state', { state, route: current.route });
}
function navigate(target, replace = false) {
  if (target.external && !/^https?:\/\//.test(target.external)) { report('外部地址无效'); return; }
  if (review && (target.external || !allowed(target))) { pending = { target, replace }; dialog.showModal(); return; }
  commitNavigation(target, replace);
}
$('#stay').onclick = () => { pending = null; dialog.close(); if (current) commitNavigation(current, true); };
$('#continue').onclick = () => { const next = pending; pending = null; dialog.close(); setMode(false); if (next) commitNavigation(next.target, next.replace); };
dialog.addEventListener('cancel', event => { event.preventDefault(); $('#stay').click(); });
$('#return').onclick = () => { setMode(true); navigate(scopes[0]); };
function initialize(sceneId) {
  const scene = bundle.scenarios.scenarios.find(scene => scene.id === sceneId);
  if (!scene) { report('场景不存在'); return; }
  state = Object.assign({}, ...Object.values(structuredClone(scene.app_states)));
  $('#scenarios').value = sceneId;
  if (ready) send('state', { state, route: current.route });
}
for (const scene of bundle.scenarios.scenarios) { const option = document.createElement('option'); option.value = scene.id; option.textContent = scene.description; $('#scenarios').append(option); }
$('#scenarios').onchange = () => initialize($('#scenarios').value);
$('#reset').onclick = () => initialize($('#scenarios').value);
const button = (container, label, callback) => { const control = document.createElement('button'); control.textContent = label; control.onclick = callback; $(container).append(control); };
for (const scope of scopes) button('#scopes', `${scope.app} ${scope.route}${scope.role === 'context' ? ' · 流程辅助' : ''}`, () => {
  const note = bundle.annotations.annotations.find(note => note.scope_id === scope.id);
  targetHighlight = note?.target?.element_id; navigate(scope);
});
for (const app of config.applications) for (const screen of app.screens) button('#apps', `${app.name} ${screen.route}`, () => navigate({ app: app.id, route: screen.route }));
for (const step of bundle.walkthrough.steps) button('#steps', step.id + ' · ' + (step.scenario || step.route), () => {
  report('');
  if (step.action === 'select_scenario') initialize(step.scenario);
  else { targetHighlight = step.target; navigate(step); }
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message?.schemaVersion !== 1 || message.app !== current?.app || typeof message.requestId !== 'string') return;
  if (message.type === 'ready') { ready = true; send('initialize', { state, route: current.route }); return; }
  if (message.context !== context) return;
  if (message.type === 'navigate' && message.payload && typeof message.payload === 'object') navigate(message.payload);
  if (message.type === 'state.patch' && message.payload?.patch && typeof message.payload.patch === 'object' && !Array.isArray(message.payload.patch)) {
    const patch = JSON.parse(JSON.stringify(message.payload.patch));
    if (Object.keys(patch).some(key => ['__proto__','constructor','prototype'].includes(key))) return;
    state = { ...state, ...patch }; send('state', { state, route: current.route });
  }
  if (message.type === 'rendered' && targetHighlight) { send('highlight', { target: targetHighlight }); targetHighlight = null; }
  if (message.type === 'diagnostic') report(`${message.payload.reason}：${message.payload.target}`);
});
window.addEventListener('popstate', () => {
  const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  navigate({ app: hash.app, route: hash.route, state: hash.state }, true);
});
initialize(bundle.scenarios.scenarios[0].id);
const initial = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
if (initial.review === 'false') setMode(false);
commitNavigation(scopes[0], true);
if (initial.app && initial.route) navigate(initial, true);
