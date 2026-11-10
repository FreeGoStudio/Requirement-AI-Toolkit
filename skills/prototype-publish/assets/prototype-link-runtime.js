(function () {
  function applyPrototypeLinks() {
    const base = window.PRD_PROTOTYPE_BASE_URL || '';
    const published = window.PRD_PROTOTYPE_PUBLISH_STATUS === 'published' && /^https?:\/\//.test(base);
    document.querySelectorAll('a[data-prototype-path]').forEach(function (link) {
      const path = link.getAttribute('data-prototype-path');
      const local = link.getAttribute('data-prototype-local-href') || link.getAttribute('href');
      if (!link.hasAttribute('data-prototype-local-href')) link.setAttribute('data-prototype-local-href', local);
      link.setAttribute('href', published ? base.replace(/\/+$/, '') + '/' + path : local);
      link.setAttribute('data-prototype-publish-status', published ? 'published' : 'pending');
      let badge = link.nextElementSibling;
      if (!badge || !badge.hasAttribute('data-prototype-link-badge')) {
        badge = document.createElement('span');
        badge.setAttribute('data-prototype-link-badge', '');
        link.insertAdjacentElement('afterend', badge);
      }
      badge.textContent = published ? '（服务器原型）' : '（待发布 · 本地原型）';
    });
    document.querySelectorAll('[data-prototype-publication-status]').forEach(function (note) {
      note.textContent = published ? '原型已发布，链接指向服务器。' : '原型待发布，当前链接使用本地文件。';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPrototypeLinks);
  else applyPrototypeLinks();
}());
