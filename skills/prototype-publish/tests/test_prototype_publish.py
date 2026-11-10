import importlib.util
import json
from pathlib import Path
import shlex
import tempfile
import unittest
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('publish', Path(__file__).parents[1] / 'scripts/prototype_publish.py')
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write('03-html-design-manifest.json', json.dumps({'flows': [{'flowId': 'login', 'flowName': '登录', 'entries': {'low': 'prototypes/low/login.html'}}]}))
        self.write('prototypes/low/login.html', '<html><a href="../../index.html#reviews">返回</a><link href="../../design-system/main.css" rel="stylesheet"><script src="../../assets/app.js"></script><button onclick="document.body.dataset.clicked=1">登录</button></html>')
        self.write('design-system/main.css', '@import "colors.css"; body{background:url(../assets/bg.svg)}')
        self.write('design-system/colors.css', 'body{color:red}')
        self.write('assets/bg.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
        self.write('assets/app.js', 'document.body.dataset.ready=1;')
        self.write('index.html', '机密需求总入口')
        self.write('06-prd.html', '机密需求文档')
        self.write('screenshots/review.png', 'review')
        self.write('design-system/index.html', '设计系统评审')

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8')

    def test_bundle_only_prototypes_and_transitive_assets(self):
        files = publish.Package(self.root).build()
        self.assertEqual(set(files), {'index.html', 'prototypes/low/login.html', 'design-system/main.css', 'design-system/colors.css', 'assets/bg.svg', 'assets/app.js'})
        self.assertIn('登录'.encode(), files['index.html'])
        self.assertNotIn(b'#reviews', files['prototypes/low/login.html'])
        self.assertIn('#reviews', (self.root / 'prototypes/low/login.html').read_text(encoding='utf-8'))
        self.assertNotIn('机密'.encode(), b''.join(files.values()))

    def test_unsafe_missing_and_document_dependencies_fail(self):
        for reference in ('../../06-prd.html', '../../../outside.png', '../../missing.png', '../../screenshots/review.png', '/assets/bg.svg', '../../03-html-design-manifest.json'):
            with self.subTest(reference=reference):
                self.write('prototypes/low/login.html', f'<a href="{reference}">link</a>')
                with self.assertRaises(publish.PublishError):
                    publish.Package(self.root).build()

    def test_srcset_inline_css_and_internal_anchor(self):
        self.write('prototypes/low/login.html', '<a href="#login">内部</a><style>body{background:url(../../assets/bg.svg)}</style><img srcset="../../assets/bg.svg 1x, ../../assets/bg.svg 2x">')
        self.assertIn('assets/bg.svg', publish.Package(self.root).build())

    def test_dynamic_resources_fail_with_source(self):
        self.write('assets/app.js', 'fetch(variable)')
        with self.assertRaisesRegex(publish.PublishError, 'assets/app.js'):
            publish.Package(self.root).build()

    def test_javascript_document_and_module_relative_dependencies(self):
        self.write('assets/app.js', "import './helper.js'; fetch('./data.json'); const icon = new URL('./bg.svg', import.meta.url);")
        self.write('assets/helper.js', 'document.body.dataset.helper=1;')
        self.write('prototypes/low/data.json', '{"message":"模拟数据"}')
        files = publish.Package(self.root).build()
        self.assertIn('assets/helper.js', files)
        self.assertIn('assets/bg.svg', files)
        self.assertIn('prototypes/low/data.json', files)
        self.assertNotIn('assets/data.json', files)

    def test_stable_id_and_copied_folder_isolation(self):
        path, state = publish.publication_state(self.root)
        self.assertEqual(state['publicationId'], publish.publication_state(self.root)[1]['publicationId'])
        other = self.root / 'copy'
        other.mkdir()
        (other / path.name).write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
        self.assertNotEqual(state['publicationId'], publish.publication_state(other)[1]['publicationId'])

    def test_failed_attempt_preserves_success_and_redacts_password(self):
        path, state = publish.publication_state(self.root)
        state['lastSuccess'] = {'url': 'http://old/'}
        publish.save_json(path, state)
        request = {'config': config(), 'password': 'secret-password', 'action': 'publish', 'outputDirectory': str(self.root)}
        def fail(_):
            raise RuntimeError('connection secret-password failed')
        with self.assertRaises(RuntimeError):
            publish.execute(request, remote_factory=fail)
        stored = json.loads(path.read_text(encoding='utf-8'))
        self.assertEqual(stored['lastSuccess']['url'], 'http://old/')
        self.assertEqual(stored['lastAttempt']['status'], 'failed')
        self.assertNotIn('secret-password', path.read_text())


def config():
    return {'schemaVersion': 1, 'host': 'example.test', 'sshPort': 22, 'username': 'tester', 'webPort': 8080, 'remoteRoot': '/var/www/prd-prototypes', 'baseUrl': 'http://example.test:8080'}


class FakeRemote:
    def __init__(self, previous=True, fail_upload=False):
        self.config = config()
        self.files = {}
        self.commands = []
        self.fail_upload = fail_upload
        self.original = '/var/www/prd-prototypes/releases/' + 'a'*32 + '/' + 'b'*32 if previous else ''
        self.current = self.original

    def run(self, command):
        self.commands.append(command)
        tokens = shlex.split(command)
        if command.startswith('readlink'):
            return self.current
        if command.startswith('sha256sum'):
            return publish.digest(self.files[tokens[-1]]) + '  file'
        if command.startswith('ln -s'):
            self.current = tokens[2]
        if command.startswith('rm -f'):
            self.current = ''
        return ''

    def put(self, path, data):
        if self.fail_upload:
            raise OSError('upload failed')
        self.files[path] = data


class HistoricalHtmlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'assets').mkdir()
        (self.root / 'index.html').write_text('<html><h1>历史原型</h1><link href="assets/main.css" rel="stylesheet"><a href="detail.htm">详情</a></html>', encoding='utf-8')
        (self.root / 'detail.htm').write_text('<a href="index.html#home">返回</a>', encoding='utf-8')
        (self.root / 'assets/main.css').write_text('body{color:blue}', encoding='utf-8')
        (self.root / 'private-notes.html').write_text('not linked', encoding='utf-8')

    def test_no_manifest_and_preserve_original_index_and_links(self):
        before = (self.root / 'index.html').read_bytes()
        files = publish.Package(self.root).build()
        self.assertEqual(set(files), {'index.html', 'detail.htm', 'assets/main.css'})
        self.assertEqual(files['index.html'], before)
        self.assertEqual((self.root / 'index.html').read_bytes(), before)
        self.assertIn(b'index.html#home', files['detail.htm'])
        self.assertFalse((self.root / '03-html-design-manifest.json').exists())

    def test_explicit_entry_can_override_manifest_and_generates_navigation(self):
        (self.root / '03-html-design-manifest.json').write_text('not a valid manifest', encoding='utf-8')
        (self.root / 'standalone.html').write_text('<h1>Standalone</h1>', encoding='utf-8')
        files = publish.Package(self.root, entry_path='standalone.html').build()
        self.assertEqual(set(files), {'index.html', 'standalone.html'})
        self.assertIn(b'standalone.html', files['index.html'])

    def test_ambiguous_entry_requires_choice(self):
        (self.root / 'index.html').unlink()
        with self.assertRaisesRegex(publish.PublishError, 'EntryPath'):
            publish.Package(self.root)

    def test_missing_escaping_and_hidden_dependencies_fail(self):
        for value in ('missing.css', '../outside.html', '.prototype-publication.json'):
            with self.subTest(value=value):
                (self.root / 'index.html').write_text(f'<a href="{value}">test</a>', encoding='utf-8')
                with self.assertRaises(publish.PublishError):
                    publish.Package(self.root).build()

    def test_explicit_entry_must_be_within_root(self):
        with self.assertRaises(publish.PublishError):
            publish.Package(self.root, mode='html', entry_path='../outside.html')


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        catalog = patch.object(publish, 'refresh_catalog', return_value={'catalogUrl': 'http://example.test/catalog/'})
        self.catalog = catalog.start()
        self.addCleanup(catalog.stop)

    def test_catalog_failure_does_not_rollback_successful_prototype(self):
        remote = FakeRemote()
        self.catalog.side_effect = RuntimeError('catalog failed')
        result = publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32, verify=lambda *args: None)
        self.assertEqual(result['status'], 'published')
        self.assertIn('catalog failed', result['catalogWarning'])
        self.assertTrue(remote.current.endswith('c'*32))

    def test_temporary_prefix_preserved_in_deploy_and_http(self):
        remote = FakeRemote(previous=False)
        remote.config['remoteRoot'] = '/var/www/_tmp/prototypes'
        remote.config['baseUrl'] = 'http://example.test:8080/_tmp/prototypes'
        publish.validate_config(remote.config)
        observed = []
        result = publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32,
                                verify=lambda url, files, version: observed.append(url))
        self.assertEqual(observed, ['http://example.test:8080/_tmp/prototypes/' + 'a'*32])
        self.assertEqual(result['url'], observed[0] + '/')
        self.assertTrue(remote.current.startswith('/var/www/_tmp/prototypes/releases/'))

    def test_invalid_url_prefixes_rejected(self):
        for suffix in ('/../private', '/x//y', '/%2e%2e', '/x?key=1', '/x#fragment', '/x;bad'):
            candidate = config()
            candidate['baseUrl'] += suffix
            with self.subTest(suffix=suffix), self.assertRaises(publish.PublishError):
                publish.validate_config(candidate)

    def test_upload_failure_does_not_switch(self):
        remote = FakeRemote(fail_upload=True)
        with self.assertRaises(OSError):
            publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32)
        self.assertEqual(remote.current, remote.original)
        self.assertTrue(remote.commands[-1].startswith('rmdir'))

    def test_http_failure_rolls_back_existing_or_initial(self):
        for previous in (True, False):
            with self.subTest(previous=previous):
                remote = FakeRemote(previous=previous)
                def fail(*args):
                    raise OSError('HTTP failed')
                with self.assertRaises(OSError):
                    publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32, verify=fail)
                self.assertEqual(remote.current, remote.original)

    def test_success_keeps_fixed_url_and_previous(self):
        remote = FakeRemote()
        result = publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32, verify=lambda *args: None)
        self.assertEqual(result['previousVersionPath'], remote.original)
        self.assertEqual(result['url'], 'http://example.test:8080/' + 'a'*32 + '/')
        self.assertTrue(remote.current.endswith('c'*32))
        result2 = publish.deploy(remote, {'index.html': b'newer'}, 'a'*32, 'd'*32, verify=lambda *args: None)
        self.assertEqual(result2['url'], result['url'])
        self.assertTrue(result2['previousVersionPath'].endswith('c'*32))

    def test_hash_failure_does_not_switch(self):
        remote = FakeRemote()
        original = remote.put
        remote.put = lambda path, data: original(path, b'corrupt')
        with self.assertRaises(publish.PublishError):
            publish.deploy(remote, {'index.html': b'new'}, 'a'*32, 'c'*32)
        self.assertEqual(remote.current, remote.original)

    def test_http_checks_each_file_content(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'expected'
        with patch.object(publish, 'urlopen', return_value=Response()) as fetch:
            publish.verify_http('http://example.test/id', {'index.html': b'expected', 'assets/a.css': b'expected'}, 'version')
            self.assertEqual(fetch.call_count, 2)
            with self.assertRaises(publish.PublishError):
                publish.verify_http('http://example.test/id', {'index.html': b'wrong'}, 'version')


class HostKeyTests(unittest.TestCase):
    def test_fingerprint_requires_confirmation_and_changed_key_rejected(self):
        import paramiko
        import base64
        import hashlib
        key = paramiko.RSAKey.generate(1024)
        replacement = paramiko.RSAKey.generate(1024)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        real_client = paramiko.SSHClient
        presented_key = [key]

        def fake_connect(client, host, **kwargs):
            known = client.get_host_keys().lookup(host)
            if known:
                if known.get(presented_key[0].get_name()) != presented_key[0]:
                    raise paramiko.BadHostKeyException(host, presented_key[0], known[key.get_name()])
            else:
                client._policy.missing_host_key(client, host, presented_key[0])

        with tempfile.TemporaryDirectory() as directory:
            request = {'config': config(), 'password': 'secret', 'configDirectory': directory}
            with patch.object(real_client, 'connect', fake_connect):
                with self.assertRaisesRegex(publish.PublishError, 'SHA256:'):
                    publish.Remote(request)
                self.assertFalse((Path(directory) / 'known_hosts').exists())
                request['trustFingerprint'] = fingerprint
                publish.Remote(request).close()
                self.assertTrue((Path(directory) / 'known_hosts').exists())
                request.pop('trustFingerprint')
                publish.Remote(request).close()
                presented_key[0] = replacement
                with self.assertRaises(paramiko.BadHostKeyException):
                    publish.Remote(request)


if __name__ == '__main__':
    unittest.main()
