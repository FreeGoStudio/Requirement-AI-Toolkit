from contextlib import contextmanager
from unittest.mock import patch
import hashlib
import io
from pathlib import Path
import shlex
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from publication_catalog import refresh_catalog, render_catalog


class Remote:
    def __init__(self):
        self.config = {'remoteRoot': '/var/www/_tmp/prototypes', 'baseUrl': 'http://example.test/_tmp/prototypes'}
        self.client = self
        self.files = {}
        self.commands = []
        self.root = self.config['remoteRoot']
        self.index = self.root + '/published/index.html'

    def open_sftp(self): return self
    def __enter__(self): return self
    def __exit__(self, *args): pass

    def open(self, path, mode):
        if path not in self.files: raise FileNotFoundError(path)
        return io.BytesIO(self.files[path])

    def put(self, path, data): self.files[path] = data

    def run(self, command):
        self.commands.append(command)
        args = shlex.split(command)
        if args[0] == 'sha256sum': return hashlib.sha256(self.files[args[-1]]).hexdigest() + ' file'
        if args[0] == 'mv': self.files[args[-1]] = self.files.pop(args[-2])
        if args[0] == 'rm': self.files.pop(args[-1], None)
        return ''

    def http(self, request, timeout):
        class Response(io.BytesIO): status = 200
        return Response(b'[]' if '/catalog/?' in request.full_url else self.files[self.index])



class CatalogTests(unittest.TestCase):
    def setUp(self):
        @contextmanager
        def scoped_lock(*args):
            yield
        lock = patch('publication_catalog.remote_lock', side_effect=scoped_lock)
        lock.start()
        self.addCleanup(lock.stop)

    def test_shell_installed_only_after_directory_api_check(self):
        remote = Remote()
        result = refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(result['catalogStatus'], 'live')
        self.assertIn(b'async function readCatalog', remote.files[remote.index])
        self.assertNotIn(b'/* CATALOG_SCRIPT */', remote.files[remote.index])

    def test_missing_api_leaves_old_page_untouched(self):
        remote = Remote()
        remote.files[remote.index] = b'old'
        def fail(*a, **k): raise OSError('404')
        with self.assertRaises(OSError):
            refresh_catalog(remote, http_open=fail)
        self.assertEqual(remote.files[remote.index], b'old')
        self.assertEqual(remote.commands, [])

    def test_failed_http_validation_restores_old_page(self):
        remote = Remote()
        old = b'<!-- Managed by prototype-publish: catalog -->old'
        remote.files[remote.index] = old
        def http(request, timeout):
            if '/catalog/?' in request.full_url:
                return remote.http(request, timeout)
            raise OSError('unavailable')
        with self.assertRaises(OSError):
            refresh_catalog(remote, http_open=http)
        self.assertEqual(remote.files[remote.index], old)

    def test_unmanaged_page_is_preserved(self):
        remote = Remote()
        remote.files[remote.index] = b'unrelated page'
        with self.assertRaisesRegex(RuntimeError, '未覆盖'):
            refresh_catalog(remote, http_open=remote.http)
        self.assertEqual(remote.files[remote.index], b'unrelated page')

if __name__ == '__main__': unittest.main()
