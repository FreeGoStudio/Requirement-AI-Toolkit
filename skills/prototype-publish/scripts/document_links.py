"""Bind root-level PRD review documents to one publication URL variable."""
import argparse
import html
from html.parser import HTMLParser
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import posixpath
import re
from urllib.parse import quote, unquote, urlsplit


class DocumentLinks(HTMLParser):
    def __init__(self, source, entries, previous_base):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.entries = entries
        self.previous_base = previous_base.rstrip('/') + '/' if previous_base else ''
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.edits = []
        self.count = 0

    def handle_starttag(self, tag, attrs):
        if tag != 'a':
            return
        values = dict(attrs)
        value = values.get('data-prototype-path') or values.get('href') or ''
        if self.previous_base and value.startswith(self.previous_base):
            value = value[len(self.previous_base):]
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path or url.path.startswith('/') or '\\' in url.path:
            return
        target = posixpath.normpath(unquote(url.path))
        if target not in self.entries:
            return
        path = quote(target, safe='/')
        if url.query:
            path += '?' + url.query
        if url.fragment:
            path += '#' + url.fragment
        # Documents live at the delivery root, so this is also the portable local href.
        values.update({'href': path, 'data-prototype-path': path, 'data-prototype-local-href': path})
        replacement = '<a' + ''.join(' ' + name + ('' if value is None else '="' + html.escape(value, quote=True) + '"') for name, value in values.items()) + '>'
        line, column = self.getpos()
        start = self.offsets[line - 1] + column
        self.edits.append((start, start + len(self.get_starttag_text()), replacement))
        self.count += 1


def sync_document_links(root, state=None, pending=False):
    root = Path(root).resolve()
    manifest_path = root / '03-html-design-manifest.json'
    if not manifest_path.is_file():
        return 0
    manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
    entries = {path for flow in manifest.get('flows', []) for fidelity, path in flow.get('entries', {}).items() if fidelity in ('low', 'high') and path}
    if state is None:
        state_path = root / '.prototype-publication.json'
        state = json.loads(state_path.read_text(encoding='utf-8-sig')) if state_path.exists() else {}
    if pending and state.get('sourceDirectory') == str(root):
        state['lastAttempt'] = {'status': 'pending', 'time': datetime.now(timezone.utc).isoformat()}
        state_path = root / '.prototype-publication.json'
        temporary = root / '.prototype-publication.links.tmp'
        temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temporary, state_path)
    success = state.get('lastSuccess', {})
    previous_base = success.get('url', '')
    published = (not pending and state.get('sourceDirectory') == str(root)
                 and state.get('lastAttempt', {}).get('status') == 'published' and bool(previous_base))
    base = previous_base.rstrip('/') if published else ''
    status = 'published' if published else 'pending'
    runtime = Path(__file__).parents[1] / 'assets/prototype-link-runtime.js'
    config = ('// Managed by prototype-publish. One base URL for all PRD documents.\n'
              + 'window.PRD_PROTOTYPE_BASE_URL = ' + json.dumps(base, ensure_ascii=False) + ';\n'
              + 'window.PRD_PROTOTYPE_PUBLISH_STATUS = ' + json.dumps(status) + ';\n'
              + runtime.read_text(encoding='utf-8'))
    # Change the shared state before touching any document.
    (root / 'prototype-links.js').write_text(config, encoding='utf-8')
    changes = []
    for document in sorted(root.glob('*.html')):
        source = document.read_text(encoding='utf-8-sig')
        parser = DocumentLinks(source, entries, previous_base)
        parser.feed(source)
        parser.close()
        if not parser.count:
            continue
        updated = source
        for start, end, replacement in reversed(parser.edits):
            updated = updated[:start] + replacement + updated[end:]
        additions = ''
        if not re.search(r'<script\b[^>]*\bdata-prototype-link-runtime(?:\s|=|>)', updated, re.I):
            additions += '\n<script src="prototype-links.js" data-prototype-link-runtime defer></script>\n'
        if not re.search(r'<[^>]+\bdata-prototype-publication-status(?:\s|=|>)', updated, re.I):
            additions += '<p data-prototype-publication-status>原型待发布，当前链接使用本地文件。</p>\n'
        if additions:
            end_body = re.search(r'</body\s*>', updated, re.I)
            point = end_body.start() if end_body else len(updated)
            updated = updated[:point] + additions + updated[point:]
        if updated != source:
            changes.append((document, updated))
    for document, content in changes:
        document.write_text(content, encoding='utf-8')
    return len(changes)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--pending', action='store_true')
    args = parser.parse_args()
    count = sync_document_links(args.root, pending=args.pending)
    print(f'Synchronized prototype links in {count} documents.')
