"""Generate the shared landing page from current published release links only."""
from datetime import datetime, timedelta, timezone
import hashlib
import html
from html.parser import HTMLParser
import re
import shlex
import stat
import uuid
from urllib.request import Request, urlopen
from remote_lock import remote_lock


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.parts.append(data)


def collect_entries(sftp, root):
    entries = []
    for item in sftp.listdir_attr(root + '/published'):
        identifier = item.filename
        if not re.fullmatch(r'[a-f0-9]{32}', identifier) or not stat.S_ISLNK(item.st_mode):
            continue
        target = sftp.readlink(root + '/published/' + identifier)
        if not re.fullmatch(re.escape(root) + '/releases/' + identifier + '/[a-f0-9]{32}', target):
            continue
        try:
            info = sftp.stat(target + '/index.html')
            if not stat.S_ISREG(info.st_mode):
                continue
            with sftp.open(target + '/index.html', 'rb') as file:
                parser = TitleParser()
                parser.feed(file.read(65536).decode('utf-8-sig', errors='replace'))
            title = ' '.join(''.join(parser.parts).split())[:160] or '未命名原型'
            entries.append({'id': identifier, 'title': title, 'updated': info.st_mtime})
        except FileNotFoundError:
            continue  # A broken historical entry is not a published prototype.
    return sorted(entries, key=lambda entry: (-entry['updated'], entry['id']))


def render_catalog(entries):
    cards = []
    for entry in entries:
        updated = datetime.fromtimestamp(entry['updated'], timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
        identifier = entry['id']
        cards.append(f'''<article><div class="meta">{html.escape(identifier[:8])}</div>
<h2><a href="{identifier}/">{html.escape(entry['title'])}</a></h2>
<p>更新时间：{updated}</p><a class="open" href="{identifier}/">打开原型 <span aria-hidden="true">→</span></a></article>''')
    body = '\n'.join(cards) if cards else '<p class="empty">还没有已发布的原型。首次发布成功后会显示在这里。</p>'
    return ('''<!doctype html>
<!-- Managed by prototype-publish: catalog -->
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>临时原型汇总</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#203148;font-family:system-ui,"Microsoft YaHei",sans-serif}
main{max-width:1080px;margin:0 auto;padding:56px 24px}header{margin-bottom:32px}.tag{display:inline-block;background:#e8eefc;color:#3556a4;border-radius:24px;padding:6px 12px;font-size:13px}
h1{font-size:clamp(28px,5vw,40px);margin:20px 0 12px}header p,footer{color:#637083;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:20px}
article{background:white;border:1px solid #e0e7ef;border-radius:16px;padding:24px;display:flex;flex-direction:column;align-items:flex-start}
.meta{font-family:monospace;font-size:12px;color:#637083}h2{font-size:20px;line-height:1.5;margin:12px 0;overflow-wrap:anywhere}a{color:#245ac5;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible{outline:3px solid #93c5fd;outline-offset:4px}
article p{font-size:13px;color:#637083;margin:0 0 24px}.open{margin-top:auto;font-weight:600}footer{margin-top:32px;font-size:13px}.empty{padding:24px;background:white;border-radius:16px}
</style></head><body><main><header><span class="tag">临时原型环境</span><h1>已发布的原型</h1>
<p>选择一个原型查看。这里展示当前发布版本，不包含历史版本和本地需求文档。</p></header>
''' + f'<p>共 {len(entries)} 个原型</p><section class="grid" aria-label="原型列表">{body}</section>' + '''
<footer>更新时间按北京时间显示。每次发布成功后自动更新；原型仅供演示与评审。</footer>
</main></body></html>''').encode('utf-8')


def refresh_catalog(remote, http_open=urlopen):
    with remote_lock(remote, "catalog"):
        return _refresh_catalog(remote, http_open)


def _refresh_catalog(remote, http_open):
    root = remote.config['remoteRoot']
    q = shlex.quote
    temporary = root + '/published/.catalog-' + uuid.uuid4().hex
    index = root + '/published/index.html'
    previous = None
    switched = False
    try:
        with remote.client.open_sftp() as sftp:
            entries = collect_entries(sftp, root)
            try:
                with sftp.open(index, 'rb') as file:
                    previous = file.read()
            except FileNotFoundError:
                pass
        if previous is not None and b'Managed by prototype-publish: catalog' not in previous:
            raise RuntimeError('汇总入口已有非本工具管理的页面，未覆盖。')
        content = render_catalog(entries)
        remote.put(temporary, content)
        checksum = remote.run('sha256sum -- ' + q(temporary)).split()[0]
        if checksum != hashlib.sha256(content).hexdigest():
            raise RuntimeError('汇总页上传校验失败。')
        switched = True
        remote.run(f'mv -Tf {q(temporary)} {q(index)}')
        url = remote.config['baseUrl'].rstrip('/') + '/'
        with http_open(Request(url + '?catalog=' + uuid.uuid4().hex, headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
            if response.status != 200 or response.read() != content:
                raise RuntimeError('汇总页 HTTP 内容校验失败。')
        return {'catalogUrl': url, 'catalogCount': len(entries)}
    except Exception:
        if switched:
            if previous is None:
                remote.run('rm -f -- ' + q(index))
            else:
                remote.put(temporary, previous)
                remote.run(f'mv -Tf {q(temporary)} {q(index)}')
        raise
    finally:
        remote.run('rm -f -- ' + q(temporary))
