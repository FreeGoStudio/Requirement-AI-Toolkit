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
let state = {}, current, review = true, pending, targetHighlight, context = crypto.randomUUID(), ready = false, frameKey, renderId, activeStep, stepTimer, highlightRequest, stepPending = false, renderedId;
const routeMap = new Map(config.applications.flatMap(app => app.screens.map(screen => [`${app.id}:${screen.route}`, { app, screen }])));
$('#title').textContent = bundle.manifest.title;
$('#version').textContent = `固定版本 ${build.build_id}`;
const send = (type, payload) => {
  const requestId = crypto.randomUUID();
  frame.contentWindow.postMessage({ type, payload, app: current.app, context, requestId, schemaVersion: 1 }, location.origin);
  return requestId;
};
const scopeTarget = scope => ({ app: scope.app, route: scope.route, state: scope.states?.[0] });
const matchesScope = (scope, target) => scope.app === target.app && scope.route === target.route && (!scope.states?.length || scope.states.includes(target.state));
const hashFor = target => new URLSearchParams({ app: target.app, route: target.route, review: String(review), ...(target.state ? { state: target.state } : {}) });
function restoreAddress() { if (current) history.replaceState(current, '', `#${hashFor(current)}`); }
function restoreState(type = 'state') {
  renderId = crypto.randomUUID();
  send(type, { state: state[current.app] || {}, appStates: state, route: current.route, viewState: current.state, renderId });
}
function diagnostic(reason, target = '') {
  clearTimeout(stepTimer); stepPending = false;
  report(`${activeStep ? `步骤 ${activeStep.id} · ` : ''}${reason} · 需求 ${reqId} · ${current?.app} ${current?.route} · 视图 ${current?.state || '默认'} · 元素 ${target || '无'} · 场景 ${$('#scenarios').value} · 构建 ${build.build_id}`);
  $('#retry').hidden = !activeStep;
}
function completeStep() {
  if (!activeStep || !stepPending) return;
  stepPending = false; clearTimeout(stepTimer); report(`步骤 ${activeStep.id} 完成`); $('#retry').hidden = true;
}
function highlight(target) { highlightRequest = send('highlight', { target, renderId }); }
function renderAnnotations() {
  $('#annotations').replaceChildren();
  if (!review || !current) return;
  for (const note of bundle.annotations.annotations) {
    const scope = scopes.find(scope => scope.id === note.scope_id);
    if (!scope || !matchesScope(scope, current)) continue;
    if (note.target && (note.target.app !== current.app || note.target.route !== current.route || (note.target.state && note.target.state !== current.state))) continue;
    const control = document.createElement(note.target?.element_id ? 'button' : 'p');
    control.textContent = note.title || note.id;
    if (note.target?.element_id) control.onclick = () => {
      cancelStep();
      targetHighlight = note.target.element_id;
      if (ready && renderedId === renderId) { highlight(targetHighlight); targetHighlight = null; }
    };
    $('#annotations').append(control);
    if (note.description) { const description = document.createElement('p'); description.textContent = note.description; $('#annotations').append(description); }
  }
}
const report = text => { $('#status').textContent = text; };
function setMode(value) { review = value; $('#mode').textContent = review ? '需求评审' : '完整产品浏览'; $('#return').style.display = review ? 'none' : 'inline-block'; renderAnnotations(); if (!review && ready) { highlightRequest = null; send('clearHighlights', {}); } }
function allowed(target) { return scopes.some(scope => matchesScope(scope, target)); }
function commitNavigation(target, replace = false) {
  if (target.external) { window.open(target.external, '_blank', 'noopener'); return; }
  const entry = routeMap.get(`${target.app}:${target.route}`);
  if (!entry) { diagnostic(`页面未登记：${target.app}${target.route}`); return; }
  if (target.newWindow) {
    const url = new URL(location.href); url.hash = hashFor(target);
    window.open(url, '_blank', 'noopener'); return;
  }
  current = target;
  renderAnnotations();
  const hash = hashFor(target);
  history[replace ? 'replaceState' : 'pushState'](target, '', `#${hash}`);
  const src = new URL(`apps/${entry.app.id}/iframe.html?id=${encodeURIComponent(entry.screen.story_id)}&viewMode=story`, location.href);
  const key = `${entry.app.id}:${entry.screen.story_id}`;
  if (frameKey !== key) { frameKey = key; context = crypto.randomUUID(); ready = false; src.searchParams.set('prototypeContext', context); frame.src = src.href; }
  else if (ready) restoreState();
}
function navigate(target, replace = false) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return;
  if (target.external && !/^https?:\/\//.test(target.external)) { report('外部地址无效'); return; }
  if (review && (target.external || !allowed(target))) { pending = { target, replace }; dialog.showModal(); return; }
  commitNavigation(target, replace);
}
$('#stay').onclick = () => { pending = null; targetHighlight = null; dialog.close(); restoreAddress(); if (activeStep) diagnostic('已留在评审，步骤尚未执行'); };
$('#continue').onclick = () => { const next = pending; pending = null; dialog.close(); setMode(false); restoreAddress(); if (next) commitNavigation(next.target, next.replace); };
dialog.addEventListener('cancel', event => { event.preventDefault(); $('#stay').click(); });
$('#return').onclick = () => { cancelStep(); setMode(true); if (allowed(current)) restoreAddress(); else navigate(scopeTarget(scopes[0])); };
function initialize(sceneId) {
  const scene = bundle.scenarios.scenarios.find(scene => scene.id === sceneId);
  if (!scene) { report('场景不存在'); return; }
  state = structuredClone(scene.app_states);
  $('#scenarios').value = sceneId;
  if (ready) restoreState();
}
for (const scene of bundle.scenarios.scenarios) { const option = document.createElement('option'); option.value = scene.id; option.textContent = scene.description; $('#scenarios').append(option); }
$('#scenarios').onchange = () => { cancelStep(); initialize($('#scenarios').value); };
$('#reset').onclick = () => { cancelStep(); initialize($('#scenarios').value); };
const button = (container, label, callback) => { const control = document.createElement('button'); control.textContent = label; control.onclick = callback; $(container).append(control); };
function cancelStep() { stepPending = false; activeStep = null; clearTimeout(stepTimer); targetHighlight = null; highlightRequest = null; $('#retry').hidden = true; }
for (const scope of scopes) for (const view of scope.states?.length ? scope.states : [undefined]) {
  button('#scopes', `${scope.app} ${scope.route}${view ? ` · ${view}` : ''}${scope.role === 'context' ? ' · 流程辅助' : ' · 重点评审'}${scope.acceptance_criteria?.length ? ` · ${scope.acceptance_criteria.join('、')}` : ''}`, () => {
    cancelStep();
    const note = bundle.annotations.annotations.find(note => note.scope_id === scope.id && note.target?.element_id && (!note.target.state || note.target.state === view));
    targetHighlight = note?.target?.element_id; navigate({ app: scope.app, route: scope.route, state: view });
  });
}
for (const app of config.applications) for (const screen of app.screens) button('#apps', `${app.name} ${screen.route}`, () => { cancelStep(); navigate({ app: app.id, route: screen.route }); });
function runStep(step) {
  cancelStep(); activeStep = step; stepPending = true; report(`步骤 ${step.id} 执行中`);
  stepTimer = setTimeout(() => diagnostic('页面渲染或定位响应超时', step.target), 10000);
  if (step.action === 'select_scenario') { initialize(step.scenario); if (!ready) return; }
  else { targetHighlight = step.target; navigate(step); }
}
for (const step of bundle.walkthrough.steps) button('#steps', step.id + ' · ' + (step.scenario || step.route), () => runStep(step));
$('#retry').onclick = () => { if (activeStep) runStep(activeStep); };
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message?.schemaVersion !== 1 || message.app !== current?.app || typeof message.requestId !== 'string') return;
  if (message.context !== context) return;
  if (message.type === 'ready') { ready = true; restoreState('initialize'); return; }
  if (message.context !== context) return;
  if (message.type === 'navigate' && message.payload && typeof message.payload === 'object') { cancelStep(); navigate(message.payload); }
  if (message.type === 'state.patch' && message.payload?.patch && typeof message.payload.patch === 'object' && !Array.isArray(message.payload.patch)) {
    const patch = JSON.parse(JSON.stringify(message.payload.patch));
    if (Object.keys(patch).some(key => ['__proto__','constructor','prototype'].includes(key))) return;
    const app = message.payload.app || current.app;
    if (!config.applications.some(item => item.id === app)) { report('状态目标应用未登记'); return; }
    state = { ...state, [app]: { ...state[app], ...patch } }; restoreState();
  }
  if (message.type === 'rendered' && message.payload?.renderId === renderId) {
    renderedId = renderId;
    if (targetHighlight) { highlight(targetHighlight); targetHighlight = null; }
    else if (!pending && !highlightRequest) completeStep();
  }
  if (message.payload?.replyTo === highlightRequest && highlightRequest) {
    if (message.type === 'diagnostic') diagnostic(message.payload.reason, message.payload.target);
    if (message.type === 'highlighted') completeStep();
    highlightRequest = null;
  }
});
window.addEventListener('popstate', () => {
  cancelStep();
  const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  navigate({ app: hash.app, route: hash.route, state: hash.state }, true);
});
initialize(bundle.scenarios.scenarios[0].id);
const initial = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
if (initial.review === 'false') setMode(false);
commitNavigation(scopeTarget(scopes[0]), true);
if (initial.app && initial.route) navigate(initial, true);
