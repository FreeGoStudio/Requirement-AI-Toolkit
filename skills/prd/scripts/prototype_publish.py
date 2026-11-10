"""Prototype-only packaging and SSH deployment. Secrets arrive via stdin, never argv."""
from __future__ import annotations

import base64
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shlex
import sys
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit, quote
from urllib.request import urlopen, Request
import uuid


class PublishError(Exception):
    pass


def save_json(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, path)


def digest(data):
    return hashlib.sha256(data).hexdigest()


CSS_URL = re.compile(r'url\(\s*([\'"]?)(.*?)\1\s*\)|@import\s+[\'"]([^\'"]+)[\'"]', re.I)
JS_URL = re.compile(r'''(?P<prefix>\b(?:fetch|import)\s*\(\s*|\bnew\s+URL\s*\(\s*|\bfrom\s+|\bimport\s+|\.(?:src|href|poster)\s*=\s*|\.setAttribute\(\s*['"](?:src|href|poster)['"]\s*,\s*)(?P<quote>['"])(?P<url>[^'"\n]+)(?P=quote)''')
RESOURCE_EXTENSIONS = {'.css', '.js', '.mjs', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mp3', '.wav'}


class Package:
    def __init__(self, root):
        self.root = Path(root).resolve()
        manifest = json.loads((self.root / '03-html-design-manifest.json').read_text(encoding='utf-8-sig'))
        self.entries = {}
        for flow in manifest['flows']:
            for fidelity, path in flow['entries'].items():
                if fidelity in ('low', 'high') and path:
                    expected = f"prototypes/{fidelity}/{flow['flowId']}.html"
                    if path != expected or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', flow['flowId']):
                        raise PublishError(f'非法原型入口：{path}')
                    self.entries[path] = f"{flow['flowName']} · {fidelity}"
        if not self.entries:
            raise PublishError('没有已登记的原型入口。')
        self.files = {}
        self.js_contexts = set()

    def reference(self, source, value, navigation=False, document=None):
        value = html.unescape(value).strip()
        if not value or value.startswith('#'):
            return
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            if parsed.scheme not in ('http', 'https', 'data', 'mailto', 'tel') and not parsed.netloc:
                raise PublishError(f'不支持的资源地址：{source}: {value}')
            return
        decoded = unquote(parsed.path)
        if not decoded:
            return
        if decoded.startswith('/') or '\\' in decoded or any(ord(c) < 32 for c in decoded):
            raise PublishError(f'需要包内相对路径：{source}: {value}')
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), decoded))
        if target == '..' or target.startswith('../'):
            raise PublishError(f'依赖越出输出目录：{source}: {value}')
        if navigation and target == 'index.html':
            return  # remote index replaces the local delivery index at the same relative path
        self.add(target, document or source)

    def css(self, source, text):
        for match in CSS_URL.finditer(text):
            self.reference(source, match.group(2) if match.group(2) is not None else match.group(3))

    def javascript(self, source, text, document=None):
        # Dynamic URLs cannot be determined from a static bundle; never silently omit them.
        if re.search(r'\b(?:fetch|import)\s*\(\s*(?![\s\'"])\S|\bnew\s+URL\s*\(\s*(?![\s\'"])\S', text):
            raise PublishError(f'动态资源地址需要改为明确的包内路径：{source}')
        for match in JS_URL.finditer(text):
            prefix = match.group('prefix').strip()
            module_relative = prefix.startswith(('import', 'from'))
            if prefix.startswith('new'):
                if not re.match(r'\s*,\s*import\.meta\.url\s*\)', text[match.end():]):
                    raise PublishError(f'new URL 需要明确 import.meta.url 基准：{source}')
                module_relative = True
            base = source if module_relative else (document or source)
            self.reference(base, match.group('url'), navigation=True, document=document)

    def add(self, path, document=None):
        if path in self.files:
            if PurePosixPath(path).suffix.lower() in ('.js', '.mjs') and (path, document) not in self.js_contexts:
                self.js_contexts.add((path, document))
                self.javascript(path, self.files[path].decode('utf-8-sig'), document)
            return
        suffix = PurePosixPath(path).suffix.lower()
        prototype_data = suffix == '.json' and PurePosixPath(path).parts[0] in ('assets', 'data', 'prototypes')
        if path not in self.entries and suffix not in RESOURCE_EXTENSIONS and not prototype_data:
            raise PublishError(f'链接指向未发布文档或不支持的资源：{path}')
        if any(part.lower() in ('screenshots', 'references', 'knowledge') for part in PurePosixPath(path).parts):
            raise PublishError(f'禁止发布参考/评审截图：{path}')
        file = (self.root / path).resolve()
        if not file.is_relative_to(self.root) or not file.is_file():
            raise PublishError(f'依赖缺失或越出输出目录：{path}')
        data = file.read_bytes()
        self.files[path] = data
        if suffix in ('.html', '.css', '.js', '.mjs', '.svg'):
            text = data.decode('utf-8-sig')
            if suffix in ('.html', '.svg'):
                parser = ResourceParser(self, path)
                parser.feed(text)
                parser.close()
                # Same path, independent index: anchors from the delivery index are stripped.
                text = re.sub(r'''(href\s*=\s*)(["'])([^"']+)\2''', lambda m: self.rewrite_home(path, m), text, flags=re.I)
                self.files[path] = text.encode('utf-8')
            elif suffix == '.css':
                self.css(path, text)
            else:
                self.js_contexts.add((path, document))
                self.javascript(path, text, document)

    def rewrite_home(self, source, match):
        parsed = urlsplit(html.unescape(match.group(3)))
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), unquote(parsed.path)))
        if not parsed.scheme and not parsed.netloc and target == 'index.html':
            return match.group(1) + match.group(2) + posixpath.relpath('index.html', posixpath.dirname(source)) + match.group(2)
        return match.group(0)

    def build(self):
        for path in self.entries:
            self.add(path)
        links = ''.join(f'<li><a href="{quote(path)}">{html.escape(label)}</a></li>' for path, label in self.entries.items())
        self.files['index.html'] = ('<!doctype html><html lang="zh-CN"><meta charset="UTF-8">'
                                   '<meta name="viewport" content="width=device-width,initial-scale=1">'
                                   '<title>交互原型</title><h1>交互原型</h1><p>使用模拟数据演示。</p><ul>'
                                   + links + '</ul></html>').encode('utf-8')
        return self.files


class ResourceParser(HTMLParser):
    def __init__(self, package, source):
        super().__init__(convert_charrefs=True)
        self.package, self.source = package, source
        self.inline = None

    def handle_starttag(self, tag, attrs):
        if tag == 'base' or any(name == 'srcdoc' for name, _ in attrs):
            raise PublishError(f'请将 base/srcdoc 改为包内明确路径：{self.source}')
        if tag == 'meta' and any(name == 'http-equiv' and (value or '').lower() == 'refresh' for name, value in attrs):
            raise PublishError(f'请用明确的原型链接替换 meta refresh：{self.source}')
        for name, value in attrs:
            if not value:
                continue
            if name in ('src', 'href', 'poster', 'xlink:href') or (tag == 'object' and name == 'data'):
                self.package.reference(self.source, value, tag == 'a' and name == 'href')
            elif name == 'srcset':
                if value.startswith('data:'):
                    continue
                for item in value.split(','):
                    self.package.reference(self.source, item.strip().split()[0])
            elif name == 'style':
                self.package.css(self.source, value)
            elif name.startswith('on'):
                self.package.javascript(self.source, value)
        if tag in ('style', 'script'):
            self.inline = tag

    def handle_endtag(self, tag):
        if tag == self.inline:
            self.inline = None

    def handle_data(self, data):
        if self.inline == 'style':
            self.package.css(self.source, data)
        elif self.inline == 'script':
            self.package.javascript(self.source, data)


def validate_config(config):
    if config.get('schemaVersion') != 1:
        raise PublishError('配置版本不支持。')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.:-]*', config['host']):
        raise PublishError('服务器地址格式不正确。')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*\$?', config['username']):
        raise PublishError('用户名格式不正确。')
    if not 1 <= int(config['sshPort']) <= 65535 or not 1024 <= int(config['webPort']) <= 65535:
        raise PublishError('端口范围不正确。')
    if not re.fullmatch(r'/(?:[a-zA-Z0-9_-]+/)+[a-zA-Z0-9_-]+', config['remoteRoot']):
        raise PublishError('远程根目录必须为专用绝对目录。')
    url = urlsplit(config['baseUrl'])
    if (url.scheme != 'http' or not url.hostname or url.username or url.password
            or not re.fullmatch(r'(?:/[A-Za-z0-9_-]+)*/?', url.path) or url.query or url.fragment):
        raise PublishError('访问地址必须是 HTTP 地址，可含规范路径前缀，不含账号、查询参数或片段。')


class Remote:
    def __init__(self, request):
        import paramiko
        self.config = request['config']
        self.password = request['password']
        self.client = paramiko.SSHClient()
        known = Path(request['configDirectory']) / 'known_hosts'
        if known.exists():
            self.client.load_host_keys(str(known))
        trust = request.get('trustFingerprint')

        class ConfirmKey(paramiko.MissingHostKeyPolicy):
            def missing_host_key(policy, client, hostname, key):
                fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
                if trust != fingerprint:
                    raise PublishError(f'首次连接，需用户核对 SSH 主机指纹：{hostname} {key.get_name()} {fingerprint}；确认后用 -TrustFingerprint 重试。')
                client.get_host_keys().add(hostname, key.get_name(), key)
                client.save_host_keys(str(known))

        self.client.set_missing_host_key_policy(ConfirmKey())
        try:
            self.client.connect(self.config['host'], port=int(self.config['sshPort']), username=self.config['username'],
                                password=self.password, look_for_keys=False, allow_agent=False,
                                timeout=15, auth_timeout=20, banner_timeout=20)
        except Exception:
            self.client.close()
            raise

    def run(self, command, input_text='', timeout=60):
        stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
        # Merge channels before draining so apt/nginx stderr cannot fill an unread buffer.
        stdout.channel.set_combine_stderr(True)
        stdin.write(input_text)
        stdin.flush()
        stdin.channel.shutdown_write()
        output = stdout.read().decode('utf-8', errors='replace')
        code = stdout.channel.recv_exit_status()
        if code:
            raise PublishError(f'远程命令失败（{code}）：{output.strip()}')
        return output.strip()

    def put(self, path, data):
        with self.client.open_sftp() as sftp:
            sftp.putfo(io.BytesIO(data), path)
            sftp.chmod(path, 0o644)

    def close(self):
        self.client.close()


def initialize(remote):
    config = remote.config
    script = Path(__file__).with_name('initialize-prototype-server.sh').read_text(encoding='utf-8')
    temporary = remote.run('mktemp /tmp/prd-init.XXXXXXXX')
    try:
        remote.put(temporary, script.encode('utf-8'))
        prefix = urlsplit(config['baseUrl']).path.rstrip('/')
        arguments = ' '.join(shlex.quote(str(v)) for v in (temporary, config['remoteRoot'], config['webPort'], config['username'], prefix))
        command = 'sh ' + arguments
        if remote.run('id -u') != '0':
            command = "sudo -S -p '' -- " + command
        result = remote.run(command, remote.password + '\n', timeout=300)
        return {'status': 'initialized', 'detail': result, 'baseUrl': config['baseUrl'],
                'pending': '发布后检查外部 HTTP；若不可达，请检查服务器防火墙和云安全组。'}
    finally:
        remote.run('rm -f -- ' + shlex.quote(temporary))


def verify_http(base_url, files, version):
    for path, expected in files.items():
        url = base_url.rstrip('/') + '/' + quote(path) + '?prd_version=' + version
        with urlopen(Request(url, headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
            if response.status != 200 or digest(response.read()) != digest(expected):
                raise PublishError(f'远程 HTTP 内容校验失败：{path}')


def deploy(remote, files, publication_id, version, verify=verify_http):
    root = remote.config['remoteRoot']
    release = f'{root}/releases/{publication_id}/{version}'
    link = f'{root}/published/{publication_id}'
    lock = f'{root}/.publish-lock'
    q = shlex.quote
    remote.run(f'test -f {q(root + "/.prd-managed")} && mkdir {q(lock)}')
    switched = False
    previous = ''
    try:
        previous = remote.run(f'readlink {q(link)} || test ! -e {q(link)}')
        if previous and not re.fullmatch(re.escape(root) + r'/releases/' + re.escape(publication_id) + r'/[a-f0-9]{32}', previous):
            raise PublishError('现有发布链接不属于本项目，停止更新。')
        remote.run(f'mkdir -p {q(release)} && chmod 755 {q(root + "/releases/" + publication_id)} {q(release)}')
        for path, data in files.items():
            target = release + '/' + path
            parents = list(PurePosixPath(path).parents)[:-1]
            directories = ' '.join(q(release + '/' + str(parent)) for parent in parents)
            remote.run('mkdir -p ' + q(posixpath.dirname(target)) + (' && chmod 755 ' + directories if directories else ''))
            remote.put(target, data)
            actual = remote.run('sha256sum -- ' + q(target)).split()[0]
            if actual != digest(data):
                raise PublishError(f'上传内容校验失败：{path}')
        temporary = link + '.next'
        # A lost SSH response may occur after mv has taken effect; attempt rollback then too.
        switched = True
        remote.run(f'ln -s {q(release)} {q(temporary)} && mv -Tf {q(temporary)} {q(link)}')
        url = remote.config['baseUrl'].rstrip('/') + '/' + publication_id
        verify(url, files, version)
        return {'status': 'published', 'url': url + '/', 'version': version, 'previousVersionPath': previous}
    except Exception as error:
        if switched:
            try:
                if previous:
                    remote.run(f'ln -s {q(previous)} {q(link + ".rollback")} && mv -Tf {q(link + ".rollback")} {q(link)}')
                else:
                    remote.run('rm -f -- ' + q(link))
            except Exception as rollback_error:
                raise PublishError(f'发布校验失败且回退失败，需检查远程状态：{rollback_error}') from error
        raise
    finally:
        remote.run('rmdir -- ' + q(lock))


def publication_state(root):
    path = Path(root) / '.prototype-publication.json'
    state = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    # A copied output folder is a new publication, not permission to overwrite the original.
    identity = str(Path(root).resolve())
    if state.get('sourceDirectory') != identity:
        state = {'publicationId': uuid.uuid4().hex, 'sourceDirectory': identity}
    if not re.fullmatch(r'[a-f0-9]{32}', state.get('publicationId', '')):
        raise PublishError('本地发布 ID 无效。')
    save_json(path, state)
    return path, state


def execute(request, remote_factory=Remote):
    validate_config(request['config'])
    state_path = state = files = None
    action = request['action']
    if action not in ('check', 'initialize', 'publish'):
        raise PublishError('未知发布操作。')
    if action == 'publish':
        state_path, state = publication_state(request['outputDirectory'])
    remote = None
    try:
        if action == 'publish':
            files = Package(request['outputDirectory']).build()
        remote = remote_factory(request)
        if action == 'check':
            return {'status': 'connected', 'system': remote.run('cat /etc/os-release; id; command -v systemctl; command -v apt-get || command -v dnf')}
        if action == 'initialize':
            return initialize(remote)
        result = deploy(remote, files, state['publicationId'], uuid.uuid4().hex)
        state.update(lastSuccess=result, lastAttempt={'status': 'published', 'time': datetime.now(timezone.utc).isoformat()})
        save_json(state_path, state)
        return result
    except Exception as error:
        if state is not None:
            message = str(error).replace(request['password'], '[REDACTED]') if request['password'] else str(error)
            state['lastAttempt'] = {'status': 'failed', 'time': datetime.now(timezone.utc).isoformat(), 'error': message}
            save_json(state_path, state)
        raise
    finally:
        if remote:
            remote.close()


def main():
    request = {}
    try:
        request = json.loads(sys.stdin.read())
        result = execute(request)
        rendered = json.dumps(result, ensure_ascii=False)
        if request.get('password'):
            rendered = rendered.replace(request['password'], '[REDACTED]')
        print(rendered)
        return 0
    except Exception as error:
        message = str(error)
        if request.get('password'):
            message = message.replace(request['password'], '[REDACTED]')
        print(json.dumps({'status': 'failed', 'error': message}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
