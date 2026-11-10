import sys
from pathlib import Path
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from prototype_publish import Package, PublishError
from local_url_rewriter import LocalUrlRewriter


class LocalUrlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()

    def write(self, path, text):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding='utf-8')

    def test_hosts_unicode_directory_query_and_fragment(self):
        self.write('中文 页面/index.html', '页面')
        rewrite = LocalUrlRewriter(self.root)
        for host in ('localhost:3000', '127.0.0.2', '10.1.2.3', '172.16.2.3',
                     '192.168.1.2', '[::1]', '[fd00::1]'):
            with self.subTest(host=host):
                self.assertEqual(rewrite.url('pages/start.html', f'http://{host}/中文%20页面/?a=1#状态'),
                                 '../%E4%B8%AD%E6%96%87%20%E9%A1%B5%E9%9D%A2/index.html?a=1#状态')
        self.assertEqual(rewrite.url('index.html', '//localhost/中文%20页面/'),
                         '%E4%B8%AD%E6%96%87%20%E9%A1%B5%E9%9D%A2/index.html')
        for url in ('https://example.com/page', 'https://8.8.8.8/a', '#state', 'mailto:a@example.com'):
            self.assertEqual(rewrite.url('index.html', url), url)
        self.assertEqual(rewrite.errors, [])

    def test_package_rewrites_and_collects_without_modifying_sources(self):
        source = '''<a href="http://192.168.1.2/pages/next.html?q=1&amp;b=2#done">下一页</a>
<link rel="stylesheet" href="http://localhost/assets/main.css">
<img srcset="http://127.0.0.1/assets/icon.svg 1x">
<button onclick="location.href='http://localhost/pages/next.html#done'">跳转</button>
<script src="http://localhost/assets/app.js"></script>'''
        self.write('index.html', source)
        self.write('pages/next.html', '<a href="http://localhost/index.html">首页</a>')
        self.write('assets/main.css', '@import "http://localhost/assets/colors.css";body{background:url(http://localhost/assets/icon.svg)}')
        self.write('assets/colors.css', 'body{color:red}')
        self.write('assets/icon.svg', '<svg></svg>')
        self.write('assets/app.js', "import 'http://localhost/assets/helper.js'; fetch('http://localhost/data.json'); const u=new URL('http://localhost/assets/icon.svg', import.meta.url);")
        self.write('assets/helper.js', 'export const x=1;')
        self.write('data.json', '{}')
        files = Package(self.root, mode='html').build()
        self.assertEqual(len(files), 8)
        self.assertIn(b'pages/next.html?q=1&amp;b=2#done', files['index.html'])
        self.assertIn(b'../index.html', files['pages/next.html'])
        self.assertIn(b"import './helper.js'", files['assets/app.js'])
        self.assertIn(b"fetch('data.json')", files['assets/app.js'])
        self.assertNotIn(b'localhost', b''.join(files.values()))
        self.assertEqual((self.root / 'index.html').read_text(encoding='utf-8'), source)

    def test_missing_and_traversal_links_are_reported_together(self):
        self.write('index.html', '<a href="http://localhost/missing.html">x</a><img src="http://10.0.0.1/missing.png"><a href="http://localhost/%2e%2e/outside.html">x</a>')
        with self.assertRaises(PublishError) as result:
            Package(self.root, mode='html').build()
        for part in ('index.html', 'missing.html', 'missing.png', '越出资源根目录'):
            self.assertIn(part, str(result.exception))

    def test_shared_script_document_relative_rewrite_conflict_blocks(self):
        self.write('index.html', '<script src="app.js"></script><a href="pages/next.html">next</a>')
        self.write('pages/next.html', '<script src="../app.js"></script>')
        self.write('app.js', "fetch('http://localhost/data.json')")
        self.write('data.json', '{}')
        with self.assertRaises(PublishError):
            Package(self.root, mode='html').build()


if __name__ == '__main__':
    unittest.main()
