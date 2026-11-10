const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = fs.readFileSync(path.join(__dirname, '../assets/prototype-link-runtime.js'), 'utf8');
function element(attrs = {}) {
  return {
    attrs, textContent: '', nextElementSibling: null,
    getAttribute(name) { return this.attrs[name] ?? null; },
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); },
    setAttribute(name, value) { this.attrs[name] = value; },
    insertAdjacentElement(position, value) { this.nextElementSibling = value; },
  };
}
const local = 'prototypes/low/login.html?mode=demo&user=1#login-error';
const link = element({ href: local, 'data-prototype-path': local });
const note = element();
const context = {
  window: { PRD_PROTOTYPE_BASE_URL: 'http://server/_tmp/prototypes/id/', PRD_PROTOTYPE_PUBLISH_STATUS: 'published' },
  document: {
    readyState: 'complete',
    querySelectorAll(selector) { return selector.startsWith('a[') ? [link] : [note]; },
    createElement() { return element(); },
  },
};
vm.runInNewContext(runtime, context);
assert.equal(link.getAttribute('href'), 'http://server/_tmp/prototypes/id/' + local);
assert.equal(link.getAttribute('data-prototype-local-href'), local);
assert.match(link.nextElementSibling.textContent, /服务器/);
const badge = link.nextElementSibling;
context.window.PRD_PROTOTYPE_BASE_URL = '';
context.window.PRD_PROTOTYPE_PUBLISH_STATUS = 'pending';
vm.runInNewContext(runtime, context);
assert.equal(link.getAttribute('href'), local);
assert.equal(link.nextElementSibling, badge);
assert.match(badge.textContent, /待发布/);
assert.match(note.textContent, /待发布/);
context.window.PRD_PROTOTYPE_BASE_URL = 'http://new-server/new/id';
context.window.PRD_PROTOTYPE_PUBLISH_STATUS = 'published';
context.document.readyState = 'loading';
context.document.addEventListener = (name, fn) => { assert.equal(name, 'DOMContentLoaded'); fn(); };
vm.runInNewContext(runtime, context);
assert.equal(link.getAttribute('href'), 'http://new-server/new/id/' + local);
console.log('PASS: server URL composition, query/anchor preservation, local fallback, visible pending status and DOM readiness.');
