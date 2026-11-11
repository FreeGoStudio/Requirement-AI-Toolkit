"""Install the static catalog shell; the browser reads the live directory API."""
import hashlib
from pathlib import Path
import shlex
import uuid
from urllib.request import Request, urlopen
from remote_lock import remote_lock


def render_catalog():
    folder = Path(__file__).parent
    return folder.joinpath('catalog.html').read_text(encoding='utf-8').replace(
        '/* CATALOG_SCRIPT */', folder.joinpath('catalog.js').read_text(encoding='utf-8')).encode('utf-8')


def refresh_catalog(remote, http_open=urlopen):
    """Explicit shell installation/upgrade only; never invoked by Publish."""
    root = remote.config['remoteRoot']
    base = remote.config['baseUrl'].rstrip('/') + '/'
    # Do not replace a working legacy page until the directory endpoint is ready.
    import json
    with http_open(Request(base + 'catalog/?check=' + uuid.uuid4().hex,
                           headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
        if response.status != 200 or not isinstance(json.load(response), list):
            raise RuntimeError('目录接口不可用；请管理员先执行 upgrade-catalog-server.sh。')
    with remote_lock(remote, 'catalog'):
        content = render_catalog()
        index = root + '/published/index.html'
        temporary = root + '/published/.catalog-' + uuid.uuid4().hex
        previous = None
        switched = False
        try:
            with remote.client.open_sftp() as sftp:
                try:
                    with sftp.open(index, 'rb') as file:
                        previous = file.read()
                except FileNotFoundError:
                    pass
            if previous is not None and b'Managed by prototype-publish: catalog' not in previous:
                raise RuntimeError('汇总入口已有非本工具管理的页面，未覆盖。')
            # Script is embedded so one atomic HTML switch installs the whole UI.
            remote.put(temporary, content)
            if remote.run('sha256sum -- ' + shlex.quote(temporary)).split()[0] != hashlib.sha256(content).hexdigest():
                raise RuntimeError('汇总页上传校验失败。')
            switched = True
            remote.run(f'mv -Tf {shlex.quote(temporary)} {shlex.quote(index)}')
            with http_open(Request(base + '?catalog=' + uuid.uuid4().hex,
                                   headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
                if response.status != 200 or response.read() != content:
                    raise RuntimeError('汇总页 HTTP 内容校验失败。')
            return {'catalogStatus': 'live', 'catalogUrl': base}
        except Exception:
            if switched:
                if previous is None:
                    remote.run('rm -f -- ' + shlex.quote(index))
                else:
                    remote.put(temporary, previous)
                    remote.run(f'mv -Tf {shlex.quote(temporary)} {shlex.quote(index)}')
            raise
        finally:
            remote.run('rm -f -- ' + shlex.quote(temporary))
