from contextlib import contextmanager
from unittest.mock import patch
import hashlib
import io
from pathlib import Path
import shlex
import stat
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from publication_catalog import collect_entries, refresh_catalog, render_catalog


class Remote:
    def __init__(self):
        self.config = {'remoteRoot': '/var/www/_tmp/prototypes', 'baseUrl': 'http://example.test/_tmp/prototypes'}
        self.client = self
        self.files = {}
        self.links = {}
        self.commands = []
        self.root = self.config['remoteRoot']
        self.index = self.root + '/published/index.html'

    def open_sftp(self): return self
    def __enter__(self): return self
    def __exit__(self, *args): pass

    def listdir_attr(self, path):
        return [SimpleNamespace(filename=name, st_mode=stat.S_IFLNK) for name in self.links] + [SimpleNamespace(filename='index.html', st_mode=stat.S_IFREG)]

    def readlink(self, path): return self.links[path.rsplit('/', 1)[1]]

    def open(self, path, mode):
        if path not in self.files: raise FileNotFoundError(path)
        return io.BytesIO(self.files[path])

    def stat(self, path):
        if path not in self.files: raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFREG, st_mtime=100)

    def put(self, path, data): self.files[path] = data

    def run(self, command):
        self.commands.append(command)
        args = shlex.split(command)
        if args[0] == 'sha256sum': return hashlib.sha256(self.files[args[-1]]).hexdigest() + ' file'
        if args[0] == 'mv': self.files[args[-1]] = self.files.pop(args[-2])
        if args[0] == 'rm': self.files.pop(args[-1], None)
        return ''

    def add(self, identifier, title):
        target = self.root + '/releases/' + identifier + '/' + 'b'*32
        self.links[identifier] = target
        self.files[target + '/index.html'] = ('<title>' + title + '</title>').encode()

    def http(self, request, timeout):
        class Response(io.BytesIO): status = 200
        return Response(self.files[self.index])


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.lock_events = []
        @contextmanager
        def scoped_lock(remote, name):
            self.lock_events.append(('enter', name))
            try:
                yield
            finally:
                self.lock_events.append(('exit', name))
        lock = patch('publication_catalog.remote_lock', side_effect=scoped_lock)
        lock.start()
        self.addCleanup(lock.stop)

    def test_cleanup_failure_still_releases_catalog_lock(self):
        remote = Remote()
        run = remote.run
        def fail_cleanup(command):
            if command.startswith('rm -f'):
                raise OSError('cleanup failed')
            return run(command)
        remote.run = fail_cleanup
        with self.assertRaisesRegex(OSError, 'cleanup failed'):
            refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(self.lock_events, [('enter', 'catalog'), ('exit', 'catalog')])

    def test_existing_entries_and_escaped_titles(self):
        remote = Remote()
        remote.add('a'*32, '&lt;script&gt;bad&lt;/script&gt;')
        remote.links['c'*32] = '/etc/private'
        remote.links['d'*32] = remote.root + '/releases/' + 'd'*32 + '/' + 'b'*32
        remote.links['not-a-project'] = '/elsewhere'
        entries = collect_entries(remote, remote.root)
        self.assertEqual(len(entries), 1)
        page = render_catalog(entries).decode()
        self.assertIn('&lt;script&gt;bad&lt;/script&gt;', page)
        self.assertNotIn('<script>', page)
        self.assertIn('href="' + 'a'*32 + '/"', page)

    def test_refresh_replaces_without_duplicate_rows(self):
        remote = Remote()
        remote.add('a'*32, '中文原型')
        result = refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(result['catalogCount'], 1)
        remote.add('c'*32, '第二个原型')
        result = refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(result['catalogCount'], 2)
        self.assertEqual(remote.files[remote.index].count(b'<article>'), 2)
        self.assertEqual(self.lock_events[-1], ('exit', 'catalog'))

    def test_http_failure_restores_old_catalog(self):
        remote = Remote()
        remote.files[remote.index] = render_catalog([])
        old = remote.files[remote.index]
        remote.add('a'*32, '原型')
        def fail(*args, **kwargs): raise OSError('unavailable')
        with self.assertRaises(OSError): refresh_catalog(remote, http_open=fail)
        self.assertEqual(remote.files[remote.index], old)

    def test_unmanaged_index_is_not_overwritten(self):
        remote = Remote()
        remote.files[remote.index] = b'existing unrelated page'
        with self.assertRaisesRegex(RuntimeError, '未覆盖'):
            refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(remote.files[remote.index], b'existing unrelated page')

    def test_empty_catalog_is_a_valid_page(self):
        remote = Remote()
        result = refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(result['catalogCount'], 0)
        self.assertIn('还没有已发布'.encode(), remote.files[remote.index])


if __name__ == '__main__': unittest.main()
