'use strict';
async function readCatalog(fetcher, parseTitle) {
  const response = await fetcher('catalog/', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('目录接口读取失败（' + response.status + '）');
  const listing = await response.json();
  if (!Array.isArray(listing)) throw new Error('目录接口返回格式不正确');
  const candidates = listing.filter(item => item.type === 'directory' && /^[a-f0-9]{32}$/.test(item.name));
  const entries = [];
  let failures = 0, next = 0;
  // Limit parallel requests, including when many prototypes have been published.
  async function worker() {
    while (next < candidates.length) {
      const item = candidates[next++];
      try {
        const page = await fetcher(item.name + '/index.html', {
          cache: 'no-store', headers: {Range: 'bytes=0-65535'}, signal: AbortSignal.timeout(15000)
        });
        if (page.status === 404) continue;
        if (!page.ok) throw new Error('首页读取失败');
        const title = parseTitle(await page.text()).trim().slice(0, 160) || '未命名原型';
        entries.push({id: item.name, title, updated: page.headers.get('Last-Modified') || item.mtime});
      } catch (_) { failures++; }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, candidates.length)}, worker));
  entries.sort((a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0) || a.id.localeCompare(b.id));
  return {entries, failures};
}

if (typeof module !== 'undefined') module.exports = {readCatalog};
if (typeof document !== 'undefined') {
  const button = document.getElementById('refresh');
  const status = document.getElementById('status');
  const grid = document.getElementById('entries');
  async function load() {
    button.disabled = true;
    status.textContent = '正在加载…';
    grid.replaceChildren();
    try {
      const {entries, failures} = await readCatalog(window.fetch.bind(window), text =>
        new DOMParser().parseFromString(text, 'text/html').title);
      for (const item of entries) {
        const card = document.createElement('article');
        const meta = document.createElement('div');
        meta.className = 'meta'; meta.textContent = item.id.slice(0, 8);
        const heading = document.createElement('h2');
        const link = document.createElement('a');
        link.href = item.id + '/'; link.textContent = item.title;
        heading.append(link);
        const date = document.createElement('p');
        date.textContent = '更新时间：' + (Number.isFinite(Date.parse(item.updated)) ?
          new Date(item.updated).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false}) : '未知');
        const open = document.createElement('a');
        open.href = link.href; open.className = 'open'; open.textContent = '打开原型 →';
        card.append(meta, heading, date, open); grid.append(card);
      }
      status.textContent = failures ? `已加载 ${entries.length} 个原型，另有 ${failures} 项读取失败，请刷新重试。` :
        entries.length ? `共 ${entries.length} 个原型` : '还没有已发布的原型。';
    } catch (error) {
      status.textContent = '加载失败：' + error.message + '。请重试；若持续失败，请检查服务器目录接口。';
    } finally { button.disabled = false; }
  }
  button.addEventListener('click', load);
  load();
}
