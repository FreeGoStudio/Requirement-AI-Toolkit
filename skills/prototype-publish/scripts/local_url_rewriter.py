"""Rewrite local-development URLs in a publication copy without fetching them."""
import html
from html.parser import HTMLParser
import ipaddress
import posixpath
import re
from urllib.parse import quote, unquote, urlsplit

CSS_URL = re.compile(r'url\(\s*([\'"]?)(.*?)\1\s*\)|@import\s+[\'"]([^\'"]+)[\'"]', re.I)
JS_URL = re.compile(r'''(?P<prefix>\b(?:fetch|import)\s*\(\s*|\bnew\s+URL\s*\(\s*|\bfrom\s+|\bimport\s+|\.(?:src|href|poster)\s*=\s*|\.setAttribute\(\s*['"](?:src|href|poster)['"]\s*,\s*)(?P<quote>['"])(?P<url>[^'"\n]+)(?P=quote)''')
LOCAL_NETWORKS = tuple(ipaddress.ip_network(value) for value in (
    '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8',
    '169.254.0.0/16', '0.0.0.0/32', '::1/128', '::/128', 'fc00::/7', 'fe80::/10'))


def is_local_host(host):
    host = (host or '').lower().rstrip('.')
    if host == 'localhost' or host.endswith('.localhost'):
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return any(address.version == network.version and address in network for network in LOCAL_NETWORKS)


class LocalUrlRewriter:
    def __init__(self, root):
        self.root = root
        self.errors = []

    def url(self, source, value):
        parsed = urlsplit(value)
        if parsed.scheme not in ('', 'http', 'https') or not parsed.netloc or not is_local_host(parsed.hostname):
            return value
        if parsed.username or parsed.password:
            self.errors.append(f'{source}: 本机/私网 URL 含账号信息，请先移除。')
            return value
        decoded = unquote(parsed.path).lstrip('/')
        if '\\' in decoded or any(ord(c) < 32 for c in decoded):
            self.errors.append(f'{source}: {value}（路径格式不支持）')
            return value
        file = (self.root / decoded).resolve()
        if not file.is_relative_to(self.root):
            self.errors.append(f'{source}: {value}（越出资源根目录）')
            return value
        if file.is_dir():
            candidates = [file / name for name in ('index.html', 'index.htm') if (file / name).is_file()]
            if candidates:
                file = candidates[0].resolve()
        if not file.is_relative_to(self.root) or not file.is_file():
            self.errors.append(f'{source}: {value}（找不到根目录内的对应文件）')
            return value
        target = file.relative_to(self.root).as_posix()
        relative = posixpath.relpath(target, posixpath.dirname(source) or '.')
        result = quote(relative, safe='/')
        if parsed.query:
            result += '?' + parsed.query
        if parsed.fragment:
            result += '#' + parsed.fragment
        return result

    def css(self, source, text):
        def replace(match):
            group = 2 if match.group(2) is not None else 3
            original = match.group(group)
            updated = self.url(source, original)
            offset = match.start(group) - match.start()
            return match.group()[:offset] + updated + match.group()[offset + len(original):]
        return CSS_URL.sub(replace, text)

    def javascript(self, source, text, document=None):
        def replace(match):
            prefix = match.group('prefix').strip()
            module_relative = prefix.startswith(('import', 'from', 'new'))
            base = source if module_relative else (document or source)
            original = match.group('url')
            updated = self.url(base, original)
            # Bare module specifiers are not relative imports.
            if updated != original and module_relative and not updated.startswith('.'):
                updated = './' + updated
            offset = match.start('url') - match.start()
            return match.group()[:offset] + updated + match.group()[offset + len(original):]
        return JS_URL.sub(replace, text)

    def markup(self, source, text):
        parser = MarkupRewriter(self, source, text)
        parser.feed(text)
        parser.close()
        for start, end, value in reversed(parser.edits):
            text = text[:start] + value + text[end:]
        return text


class MarkupRewriter(HTMLParser):
    def __init__(self, rewrite, source, text):
        super().__init__(convert_charrefs=True)
        self.rewrite, self.source = rewrite, source
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.edits = []
        self.inline = None

    def edit(self, original, updated):
        if original != updated:
            line, column = self.getpos()
            start = self.offsets[line - 1] + column
            self.edits.append((start, start + len(original), updated))

    def handle_starttag(self, tag, attrs):
        rewritten = []
        for name, value in attrs:
            updated = value
            if value:
                if name in ('href', 'src', 'poster', 'xlink:href') or (tag == 'object' and name == 'data'):
                    updated = self.rewrite.url(self.source, value)
                elif name == 'srcset' and not value.startswith('data:'):
                    parts = []
                    for item in value.split(','):
                        pieces = item.strip().split(maxsplit=1)
                        if pieces:
                            pieces[0] = self.rewrite.url(self.source, pieces[0])
                        parts.append(' '.join(pieces))
                    updated = ', '.join(parts)
                elif name == 'style':
                    updated = self.rewrite.css(self.source, value)
                elif name.startswith('on'):
                    updated = self.rewrite.javascript(self.source, value)
            rewritten.append((name, updated))
        original = self.get_starttag_text()
        if rewritten != attrs:
            closing = '/>' if original.endswith('/>') else '>'
            updated = '<' + tag + ''.join(' ' + name + ('' if value is None else '="' + html.escape(value, quote=True) + '"') for name, value in rewritten) + closing
            self.edit(original, updated)
        if tag in ('style', 'script'):
            self.inline = tag

    def handle_endtag(self, tag):
        if self.inline == tag:
            self.inline = None

    def handle_data(self, data):
        if self.inline == 'style':
            self.edit(data, self.rewrite.css(self.source, data))
        elif self.inline == 'script':
            self.edit(data, self.rewrite.javascript(self.source, data))
