export function connect(app, root, render, options = {}) {
  const standalone = window.parent === window;
  let state = {}, appStates = {}, viewState, route = options.initialRoute || '/', context = new URLSearchParams(location.search).get('prototypeContext'), destroyed = false;
  const request = (type, payload = {}) => {
    if (standalone) {
      if (type === 'navigate') { route = payload.route; draw(); }
      if (type === 'state.patch') { state = { ...state, ...payload.patch }; draw(); }
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
    request('rendered', { route, elements: [...root.querySelectorAll('[data-prototype-id]')].map(e => e.dataset.prototypeId) });
  };
  const receive = event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.schemaVersion !== 1 || message.app !== app || typeof message.requestId !== 'string') return;
    if (message.type === 'initialize' && message.context === context) {
      context = message.context; state = message.payload.state; route = message.payload.route; appStates = message.payload.appStates; viewState = message.payload.viewState; draw();
    } else if (message.context === context && message.type === 'state') {
      state = message.payload.state; route = message.payload.route; appStates = message.payload.appStates; viewState = message.payload.viewState; draw();
    } else if (message.context === context && message.type === 'highlight') {
      root.querySelectorAll('[data-highlight]').forEach(e => e.removeAttribute('data-highlight'));
      const matches = [...root.querySelectorAll('[data-prototype-id]')].filter(e => e.dataset.prototypeId === message.payload.target);
      const visible = matches.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
      if (matches.length !== 1 || visible.length !== 1) request('diagnostic', { reason: '标注目标缺失、重复或不可见', target: message.payload.target });
      else { visible[0].dataset.highlight = 'true'; visible[0].scrollIntoView({ block: 'nearest' }); }
    }
  };
  // All links in a participating application are routed through the same boundary.
  const click = event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) api.external(url.href);
    else api.navigate(link.dataset.app || app, link.dataset.route || url.pathname, { newWindow: link.target === '_blank' || event.ctrlKey || event.metaKey });
  };
  window.addEventListener('message', receive); root.addEventListener('click', click);
  request('ready');
  if (standalone) draw();
  const observer = new MutationObserver(() => {
    if (!root.isConnected) { destroyed = true; window.removeEventListener('message', receive); observer.disconnect(); }
  });
  setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 0);
  return api;
}
