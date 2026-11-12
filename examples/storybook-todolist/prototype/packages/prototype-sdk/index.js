export function connect(app, root, render, options = {}) {
  const context = new URLSearchParams(location.search).get('prototypeContext');
  // Manager also embeds its preview: only the player's explicit context opts in.
  const standalone = !context;
  let state = structuredClone(options.initialState || {}), appStates = {}, renderId, viewState, route = options.initialRoute || '/', destroyed = false, initialized = false;
  appStates[app] = state;
  let handshakeTimer;
  const request = (type, payload = {}) => {
    if (standalone) {
      if (type === 'navigate') {
        if (payload.external || payload.app !== app) { root.setAttribute('data-prototype-diagnostic', '跨应用流程请从平台播放器打开'); return; }
        route = payload.route; viewState = payload.state; draw();
      }
      if (type === 'state.patch') {
        appStates[payload.app] = { ...appStates[payload.app], ...payload.patch };
        state = appStates[app]; draw();
      }
      return;
    }
    window.parent.postMessage({ type, payload, app, requestId: crypto.randomUUID(), schemaVersion: 1, context }, location.origin);
  };
  const api = {
    navigate: (targetApp, targetRoute, options = {}) => request('navigate', { app: targetApp, route: targetRoute, ...options }),
    patch: (patch, targetApp = app) => request('state.patch', { patch, app: targetApp }),
    external: url => request('navigate', { external: url })
  };
  const draw = () => {
    if (destroyed) return;
    render(root, { state, appStates, viewState, route, ...api });
    root.dataset.prototypeRoute = route;
    request('rendered', { route, renderId, elements: [...root.querySelectorAll('[data-prototype-id]')].map(e => e.dataset.prototypeId) });
  };
  const receive = event => {
    if (standalone || destroyed || event.source !== window.parent || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.schemaVersion !== 1 || message.app !== app || typeof message.requestId !== 'string' || !message.payload || typeof message.payload !== 'object') return;
    if (message.type === 'initialize' && message.context === context) {
      initialized = true; clearTimeout(handshakeTimer); root.removeAttribute('data-prototype-diagnostic');
      state = message.payload.state; route = message.payload.route; appStates = message.payload.appStates; viewState = message.payload.viewState; renderId = message.payload.renderId; draw();
    } else if (initialized && message.context === context && message.type === 'state') {
      state = message.payload.state; route = message.payload.route; appStates = message.payload.appStates; viewState = message.payload.viewState; renderId = message.payload.renderId; draw();
    } else if (message.context === context && message.type === 'clearHighlights') {
      root.querySelectorAll('[data-highlight]').forEach(e => e.removeAttribute('data-highlight'));
    } else if (message.context === context && message.type === 'highlight' && message.payload.renderId === renderId) {
      root.querySelectorAll('[data-highlight]').forEach(e => e.removeAttribute('data-highlight'));
      const matches = [...root.querySelectorAll('[data-prototype-id]')].filter(e => e.dataset.prototypeId === message.payload.target);
      const visible = matches.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
      if (matches.length !== 1 || visible.length !== 1) request('diagnostic', { reason: '标注目标缺失、重复或不可见', target: message.payload.target, replyTo: message.requestId });
      else { visible[0].dataset.highlight = 'true'; visible[0].scrollIntoView({ block: 'nearest' }); request('highlighted', { target: message.payload.target, replyTo: message.requestId }); }
    }
  };
  // All links in a participating application are routed through the same boundary.
  const click = event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) api.external(url.href);
    else api.navigate(link.dataset.app || app, link.dataset.route || url.pathname, { state: link.dataset.state, newWindow: link.target === '_blank' || event.ctrlKey || event.metaKey });
  };
  window.addEventListener('message', receive); root.addEventListener('click', click);
  request('ready');
  if (standalone) draw();
  else handshakeTimer = setTimeout(() => {
    if (!initialized && !destroyed) {
      root.dataset.prototypeDiagnostic = '平台会话初始化超时';
      root.textContent = '平台会话初始化超时，请从固定原型入口重新打开。';
    }
  }, options.handshakeTimeoutMs ?? 10000);
  const observer = new MutationObserver(() => {
    if (!root.isConnected) { destroyed = true; clearTimeout(handshakeTimer); window.removeEventListener('message', receive); root.removeEventListener('click', click); observer.disconnect(); }
  });
  setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 0);
  return api;
}
