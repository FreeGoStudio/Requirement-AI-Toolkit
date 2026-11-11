"""Run on Linux (including WSL) to exercise real flock/process lifetimes."""
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from remote_lock import lock_command, remote_lock


class LockSessionTests(unittest.TestCase):
    def session(self, ready='READY\n'):
        remote = MagicMock()
        remote.config = {'remoteRoot': '/tmp/prototypes'}
        stdout = MagicMock()
        stdout.readline.return_value = ready
        remote.client.exec_command.return_value = (MagicMock(), stdout, io.BytesIO(b'failure'))
        return remote, stdout.channel

    def test_operation_failure_closes_lock_channel(self):
        remote, channel = self.session()
        with self.assertRaisesRegex(OSError, 'operation failed'):
            with remote_lock(remote, 'catalog'):
                raise OSError('operation failed')
        channel.shutdown_write.assert_called_once()
        channel.close.assert_called_once()
        remote.client.close.assert_not_called()

    def test_acquisition_failure_never_enters_operation_and_closes_channel(self):
        remote, channel = self.session('')
        with self.assertRaisesRegex(RuntimeError, '无法取得发布锁'):
            with remote_lock(remote, 'catalog'):
                self.fail('Must not mutate without lock')
        channel.close.assert_called_once()


@unittest.skipUnless(sys.platform == 'linux', 'Requires Linux bash/flock')
class KernelLockTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = self.temp.name
        Path(self.root, '.prd-managed').touch()
        # Old abandoned directory locks must not block the new protocol.
        Path(self.root, '.publish-lock').mkdir()

    def start(self, name='catalog', idle=5):
        process = subprocess.Popen(
            ['bash', '-c', lock_command(self.root, name, wait=1, idle=idle)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, start_new_session=True)
        def cleanup():
            if process.poll() is None:
                process.kill()
            process.communicate(timeout=3)
        self.addCleanup(cleanup)
        return process

    def ready(self, process):
        self.assertEqual(process.stdout.readline(), 'READY\n')

    def test_same_publication_excluded_different_publications_and_catalog_parallel(self):
        name = 'publication-' + 'a'*32
        self.ready(self.start(name))
        blocked = self.start(name)
        self.assertEqual(blocked.wait(timeout=3), 75)
        self.ready(self.start('publication-' + 'b'*32))
        self.ready(self.start('catalog'))

    def test_eof_releases_and_persistent_lock_file_is_reusable(self):
        first = self.start()
        self.ready(first)
        first.stdin.close()
        first.stdin = None
        first.wait(timeout=3)
        self.assertTrue(Path(self.root, '.locks/catalog').exists())
        self.ready(self.start())

    def test_killed_holder_releases(self):
        first = self.start()
        self.ready(first)
        first.kill()
        first.wait(timeout=3)
        self.ready(self.start())

    def test_missing_heartbeat_expires(self):
        first = self.start(idle=1)
        self.ready(first)
        first.wait(timeout=3)
        self.ready(self.start())

    def test_heartbeat_keeps_holder_alive(self):
        first = self.start()
        self.ready(first)
        first.stdin.write('PING\n')
        first.stdin.flush()
        self.assertEqual(first.stdout.readline(), 'PONG\n')
        self.assertIsNone(first.poll())


if __name__ == '__main__':
    unittest.main()
