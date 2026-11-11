import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from repo_fixture import create_project, push_project, command
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import prototype_publish as publish
from repository_contract import verify_pushed_source, load_project


class RepositoryWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.repo, self.root = create_project(self.temp.name)
        self.proto = self.root / 'prototypes/high/login.html'
        self.proto.parent.mkdir(parents=True)
        self.proto.write_text('<html><h1>login</h1></html>', encoding='utf-8')
        (self.root / '03-html-design-manifest.json').write_text(json.dumps({'schemaVersion':2,'flows':[{'flowId':'login','flowName':'登录','entries':{'high':'working/demo/prototypes/high/login.html'}}]}), encoding='utf-8')
        self.commit = push_project(self.repo, self.root, self.temp.name)
        self.config = {'schemaVersion':1, 'host':'example.test','sshPort':22,'username':'tester','webPort':8080,'remoteRoot':'/var/www/prd-prototypes','baseUrl':'http://example.test:8080'}
        self.request = {'action':'publish','mode':'prd','outputDirectory':str(self.root),'config':self.config,'password':'unused'}

    def test_pushed_source_is_accepted_but_dirty_or_unpushed_is_not(self):
        self.assertEqual(verify_pushed_source(self.root, {'prototypes/high/login.html'}, self.config), self.commit)
        self.proto.write_text('<html>changed</html>')
        with self.assertRaisesRegex(ValueError, '未提交'):
            verify_pushed_source(self.root, {'prototypes/high/login.html'}, self.config)
        command(self.repo,'add','.'); command(self.repo,'commit','-qm','unpublished')
        with self.assertRaisesRegex(ValueError, '尚未推送'):
            verify_pushed_source(self.root, {'prototypes/high/login.html'}, self.config)

    def test_cloned_repository_reuses_identity_and_mismatched_target_is_rejected(self):
        _, original = publish.publication_state(self.root, prd=True)
        clone = Path(self.temp.name)/'clone'
        subprocess.run(['git','clone','-q','--branch','requirement/demo',str(Path(self.temp.name)/'remote.git'),str(clone)],check=True)
        _, cloned = publish.publication_state(clone/'working/demo', prd=True)
        self.assertEqual(original['publicationId'],cloned['publicationId'])
        with self.assertRaisesRegex(ValueError, '目标'):
            verify_pushed_source(self.root, {'prototypes/high/login.html'}, dict(self.config,host='other.test'))

    def test_publish_records_source_and_record_only_commit_does_not_upload(self):
        result = {'status':'published','url':self.config['baseUrl']+'/'+'a'*32+'/','version':'c'*32}
        remote = Mock()
        with patch.object(publish,'deploy',return_value=result) as deploy:
            published = publish.execute(self.request, remote_factory=lambda _:remote)
            self.assertEqual(published['sourceCommit'], self.commit)
            deploy.assert_called_once()
        record = json.loads((self.root/'publication-record.json').read_text())
        self.assertEqual(record['sourceCommit'],self.commit)
        command(self.repo,'add','.'); command(self.repo,'commit','-qm','record only'); command(self.repo,'push','-q')
        with patch.object(publish,'deploy') as deploy, patch.object(publish,'verify_http') as verify:
            unchanged = publish.execute(self.request, remote_factory=Mock(side_effect=AssertionError('no SSH expected')))
            self.assertEqual(unchanged['status'],'unchanged')
            self.assertEqual(unchanged['sourceCommit'], self.commit)
            deploy.assert_not_called(); verify.assert_called_once()
        self.assertEqual(command(self.repo,'status','--porcelain'),'')

    def test_unpushed_commit_cannot_connect_or_upload(self):
        self.proto.write_text('<html>new</html>')
        command(self.repo,'add','.'); command(self.repo,'commit','-qm','local only')
        remote_factory = Mock()
        with self.assertRaisesRegex(ValueError,'尚未推送'):
            publish.execute(self.request,remote_factory=remote_factory)
        remote_factory.assert_not_called()
        self.assertFalse((self.root/'publication-record.json').exists())

    def test_worktree_resolves_its_own_root_and_keeps_portable_identity(self):
        worktree = Path(self.temp.name) / 'parallel-worktree'
        command(self.repo, 'worktree', 'add', '-q', '-b', 'requirement/review', str(worktree), 'HEAD')
        repo, root, project = load_project(worktree / 'working/demo')
        self.assertEqual(repo, worktree.resolve())
        self.assertEqual(root, (worktree / 'working/demo').resolve())
        self.assertEqual(project['publicationId'], 'a'*32)

    def test_duplicate_requirement_identity_is_rejected(self):
        other = self.repo / 'working/other'
        other.mkdir()
        data = json.loads((self.root / 'requirement.json').read_text())
        data['requirementId'] = 'other'
        (other / 'requirement.json').write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, '新 ID'):
            load_project(self.root)


if __name__ == '__main__': unittest.main()
