import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from document_links import sync_document_links


class DocumentLinkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.path = 'prototypes/high/login.html'
        (self.root / '03-html-design-manifest.json').write_text(json.dumps({'flows': [{'entries': {'high': self.path}}]}), encoding='utf-8')
        self.original = '<html><body><a class="test" href="prototypes/high/login.html?mode=demo&amp;user=1#login-error">查看错误</a><a href="08-bdd.html">BDD</a></body></html>'
        (self.root / '06-prd.html').write_text(self.original, encoding='utf-8')
        (self.root / '08-bdd.html').write_text(self.original, encoding='utf-8')
        self.state = {'sourceDirectory': str(self.root), 'lastAttempt': {'status': 'published'}, 'lastSuccess': {'url': 'http://example.test/_tmp/prototypes/id/'}}

    def test_shared_base_preserves_local_href_query_and_anchor(self):
        sync_document_links(self.root, self.state)
        config = (self.root / 'prototype-links.js').read_text(encoding='utf-8')
        self.assertIn('window.PRD_PROTOTYPE_BASE_URL = "http://example.test/_tmp/prototypes/id"', config)
        for name in ('06-prd.html', '08-bdd.html'):
            document = (self.root / name).read_text(encoding='utf-8')
            self.assertNotIn('http://example.test', document)
            self.assertIn('data-prototype-path="prototypes/high/login.html?mode=demo&amp;user=1#login-error"', document)
            self.assertIn('<a href="08-bdd.html">BDD</a>', document)
            self.assertEqual(document.count('data-prototype-link-runtime'), 1)

    def test_legacy_manifest_stops_before_document_changes(self):
        (self.root / '03-html-design-manifest.json').write_text(json.dumps({'flows': [{'entries': {'low': '', 'high': self.path}}]}), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '迁移'):
            sync_document_links(self.root, self.state)
        self.assertEqual((self.root / '06-prd.html').read_text(encoding='utf-8'), self.original)
        self.assertFalse((self.root / 'prototype-links.js').exists())

    def test_failed_or_unconfigured_clears_remote_base(self):
        sync_document_links(self.root, self.state)
        self.state['lastAttempt']['status'] = 'failed'
        sync_document_links(self.root, self.state)
        text = (self.root / 'prototype-links.js').read_text(encoding='utf-8')
        self.assertIn('window.PRD_PROTOTYPE_BASE_URL = ""', text)
        self.assertIn('window.PRD_PROTOTYPE_PUBLISH_STATUS = "pending"', text)
        self.assertIn('原型待发布', (self.root / '06-prd.html').read_text(encoding='utf-8'))
        sync_document_links(self.root, {})
        self.assertIn('window.PRD_PROTOTYPE_BASE_URL = ""', (self.root / 'prototype-links.js').read_text(encoding='utf-8'))

    def test_repeat_sync_and_host_change_only_updates_shared_variable(self):
        sync_document_links(self.root, self.state)
        first = (self.root / '06-prd.html').read_bytes()
        self.state['lastSuccess']['url'] = 'http://other.test/new/id/'
        sync_document_links(self.root, self.state)
        self.assertEqual(first, (self.root / '06-prd.html').read_bytes())
        self.assertIn('http://other.test/new/id', (self.root / 'prototype-links.js').read_text())
        sync_document_links(self.root, self.state, pending=True)
        self.assertIn('window.PRD_PROTOTYPE_BASE_URL = ""', (self.root / 'prototype-links.js').read_text(encoding='utf-8'))

    def test_copied_directory_does_not_claim_old_publish_success(self):
        self.state['sourceDirectory'] = 'different-directory'
        sync_document_links(self.root, self.state)
        self.assertIn('window.PRD_PROTOTYPE_PUBLISH_STATUS = "pending"', (self.root / 'prototype-links.js').read_text(encoding='utf-8'))

    def test_no_manifest_does_not_modify_historical_html(self):
        (self.root / '03-html-design-manifest.json').unlink()
        self.assertEqual(sync_document_links(self.root, self.state), 0)
        self.assertEqual((self.root / '06-prd.html').read_text(encoding='utf-8'), self.original)
        self.assertFalse((self.root / 'prototype-links.js').exists())


if __name__ == '__main__':
    unittest.main()
