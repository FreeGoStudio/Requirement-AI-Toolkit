import json
from pathlib import Path
import sys
import tempfile
import unittest
from repo_fixture import create_project
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from document_links import sync_document_links


class DocumentLinkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo, self.root = create_project(self.temp.name)
        self.prd = self.repo / 'docs/requirements/demo/index.md'
        self.original = self.prd.read_bytes()
        proto = self.root / 'prototypes/high/login.html'
        proto.parent.mkdir(parents=True); proto.write_text('<html>login</html>')
        self.manifest = {'schemaVersion': 2, 'flows': [{'flowId': 'login', 'flowName': '登录', 'entries': {'high': 'working/demo/prototypes/high/login.html'}}]}
        (self.root / '03-html-design-manifest.json').write_text(json.dumps(self.manifest))
        self.state = {'publicationId': 'a'*32, 'lastAttempt': {'status': 'published'}, 'lastSuccess': {'url': 'http://example.test/id/', 'sourceCommit': 'b'*40, 'version': 'c'*32}}

    def test_only_marked_region_changes_and_repeat_is_idempotent(self):
        sync_document_links(self.root, self.state)
        result = self.prd.read_text(encoding='utf-8')
        self.assertTrue(result.startswith('业务规则保持不变。\n'))
        self.assertTrue(result.endswith('正文结束。\n'))
        self.assertIn('http://example.test/id/prototypes/high/login.html', result)
        self.assertIn('b'*40, result)
        self.assertEqual(sync_document_links(self.root, self.state), 0)
        self.assertFalse((self.root / 'prototype-links.js').exists())

    def test_pending_removes_current_success_claim(self):
        sync_document_links(self.root, self.state)
        sync_document_links(self.root, self.state, pending=True)
        text = self.prd.read_text(encoding='utf-8')
        self.assertIn('本次待发布', text)
        self.assertNotIn('http://', text)
        self.assertNotIn('已发布', text)

    def test_invalid_second_document_does_not_partially_write_first(self):
        second = self.root / 'index.md'; second.write_text('missing block')
        path = self.root / 'requirement.json'; data = json.loads(path.read_text())
        data['documents'].append({'path': 'working/demo/index.md'})
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, '标记区'):
            sync_document_links(self.root, self.state)
        self.assertEqual(self.prd.read_bytes(), self.original)

    def test_legacy_requires_migration(self):
        self.manifest['flows'][0]['entries']['low'] = ''
        (self.root / '03-html-design-manifest.json').write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, '迁移'):
            sync_document_links(self.root, self.state)
        self.assertEqual(self.prd.read_bytes(), self.original)

    def test_fragment_and_query_and_crlf_preserved(self):
        self.prd.write_bytes(self.original.replace(b'\n', b'\r\n'))
        path = self.root / 'requirement.json'; data = json.loads(path.read_text())
        data['documents'][0]['links'] = [{'flowId': 'login', 'query': {'mode':'demo'}, 'fragment':'login-error'}]
        path.write_text(json.dumps(data))
        sync_document_links(self.root, self.state)
        result = self.prd.read_bytes()
        self.assertIn(b'?mode=demo#login-error', result)
        self.assertNotIn(b'\n', result.replace(b'\r\n', b''))

    def test_unrelated_requirement_is_rejected(self):
        other = self.repo / 'working/other/index.md'; other.parent.mkdir(); other.write_text('private')
        path = self.root / 'requirement.json'; data = json.loads(path.read_text())
        data['documents'].append({'path':'working/other/index.md'})
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, '本需求'):
            sync_document_links(self.root, self.state)


if __name__ == '__main__':
    unittest.main()
