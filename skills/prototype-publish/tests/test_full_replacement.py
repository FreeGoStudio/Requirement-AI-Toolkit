"""Real filesystem deployment tests, run on Linux/WSL."""
from contextlib import nullcontext
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import prototype_publish as publish


class LocalRemote:
    def __init__(self, root):
        self.config = {'remoteRoot': str(root), 'baseUrl': 'http://example.test'}

    def run(self, command):
        return subprocess.check_output(['sh', '-c', command], text=True).strip()

    def put(self, path, data):
        Path(path).write_bytes(data)


@unittest.skipUnless(sys.platform == 'linux', 'Requires Linux atomic symlink replacement')
class ReplacementTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / '.prd-managed').touch()
        (self.root / 'published').mkdir()
        self.identifier = 'a' * 32
        self.old = self.root / 'releases' / self.identifier / ('b' * 32)
        self.old.mkdir(parents=True)
        (self.old / 'index.html').write_bytes(b'old')
        (self.old / 'removed.txt').write_bytes(b'obsolete')
        self.link = self.root / 'published' / self.identifier
        self.link.symlink_to(self.old)
        self.remote = LocalRemote(self.root)
        lock = patch.object(publish, 'remote_lock', side_effect=lambda *args: nullcontext())
        lock.start()
        self.addCleanup(lock.stop)

    def test_republish_replaces_all_files_and_cleans_only_this_publication(self):
        other = self.root / 'releases' / ('d' * 32) / ('e' * 32)
        other.mkdir(parents=True)
        uploading = self.root / '.uploads' / self.identifier / ('f' * 32)
        uploading.mkdir(parents=True)
        preserved = self.old.parent / 'notes'
        preserved.mkdir()
        external_link = self.old.parent / ('1' * 32)
        external_link.symlink_to(other)
        files = {'index.html': b'new complete page', 'assets/new.txt': b'new resource'}
        def verify(*args):
            self.assertTrue(self.old.exists(), 'Keep old release until validation succeeds')
            self.assertFalse((self.link / 'removed.txt').exists())
            for path, data in files.items():
                self.assertEqual((self.link / path).read_bytes(), data)
        result = publish.deploy(self.remote, files, self.identifier, 'c' * 32, verify=verify)
        self.assertEqual(result['cleanupStatus'], 'complete')
        self.assertFalse(self.old.exists())
        self.assertTrue(other.exists())
        self.assertTrue(uploading.exists())
        self.assertTrue(preserved.exists())
        self.assertTrue(external_link.is_symlink())
        second = publish.deploy(self.remote, {'index.html': b'third'}, self.identifier,
                                '2' * 32, verify=lambda *args: None)
        self.assertEqual(result['url'], second['url'])
        self.assertFalse((self.link / 'assets/new.txt').exists())
        self.assertFalse((self.old.parent / ('c' * 32)).exists())

    def test_validation_failure_retains_previous_display(self):
        def fail(*args):
            raise OSError('HTTP validation failed')
        with self.assertRaises(OSError):
            publish.deploy(self.remote, {'index.html': b'new'}, self.identifier, 'c' * 32, verify=fail)
        self.assertEqual(self.link.resolve(), self.old)
        self.assertEqual((self.link / 'index.html').read_bytes(), b'old')

    def test_cleanup_failure_reports_warning_without_reverting_new_display(self):
        with patch.object(publish, 'cleanup_releases', side_effect=OSError('permission denied')):
            result = publish.deploy(self.remote, {'index.html': b'new'}, self.identifier,
                                    'c' * 32, verify=lambda *args: None)
        self.assertEqual(result['status'], 'published')
        self.assertEqual(result['cleanupStatus'], 'pending')
        self.assertIn('permission denied', result['cleanupWarning'])
        self.assertEqual((self.link / 'index.html').read_bytes(), b'new')


if __name__ == '__main__':
    unittest.main()
