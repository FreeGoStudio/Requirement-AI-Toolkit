import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).parents[1] / 'skill_maintenance.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='技能 中文 space ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        m.git(self.repo, 'init')
        m.git(self.repo, 'config', 'user.name', 'Test')
        m.git(self.repo, 'config', 'user.email', 'test@example.invalid')
        self.skill = self.repo / 'skills' / 'prd'
        self.skill.mkdir(parents=True)
        (self.skill / 'SKILL.md').write_text('---\nname: prd\ndescription: 测试\n---\n正文\n', encoding='utf-8')
        (self.skill / 'data.txt').write_text('one\n\n\n\n\nend\n')
        self.first = self.commit()
        self.home = self.root / 'home'
        self.target = self.home / 'skills' / 'prd'

    def commit(self):
        m.git(self.repo, 'add', '.')
        m.git(self.repo, 'commit', '-m', 'fixture')
        return m.git(self.repo, 'rev-parse', 'HEAD')

    def install(self, revision='HEAD'):
        return m.install(self.repo, self.home, 'prd', revision)

    def test_updates_rollback_and_inventory(self):
        self.install()
        for version in ['two', 'three']:
            (self.skill / 'data.txt').write_text(version)
            self.commit()
            self.install()
        self.install(self.first)
        self.assertEqual((self.target / 'data.txt').read_text(), 'one\n\n\n\n\nend\n')
        self.assertEqual(list((self.home / 'skills').iterdir()), [self.target])
        self.assertEqual(len(list((self.home / 'skill-history').glob('*.zip'))), 3)
        cfg = {'roots': [{'path': str(self.home / 'skills')}], 'formal': [str(self.target)]}
        before = m.files(self.target)
        self.assertFalse(m.inventory(cfg)['errors'])
        self.assertEqual(before, m.files(self.target))

    def test_conflict_preserves_local_files(self):
        self.install()
        (self.target / 'data.txt').write_text('local\n')
        before = m.files(self.target)
        (self.skill / 'data.txt').write_text('upstream\n')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            self.install()
        self.assertEqual(before, m.files(self.target))

    def test_nonconflicting_local_changes_survive_repeated_updates(self):
        self.install()
        (self.target / 'personal.txt').write_text('keep me')
        (self.target / 'data.txt').write_text('local\n\n\n\n\nend\n')
        (self.skill / 'data.txt').write_text('one\n\n\n\n\nupstream\n')
        self.commit()
        self.install()
        self.install()
        self.assertEqual((self.target / 'personal.txt').read_text(), 'keep me')
        self.assertEqual((self.target / 'data.txt').read_text(), 'local\n\n\n\n\nupstream\n')

    def test_invalid_candidate_leaves_target(self):
        self.install()
        before = m.files(self.target)
        (self.skill / 'bad.ps1').write_text('function {')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'validation failed'):
            self.install()
        self.assertEqual(before, m.files(self.target))

    def test_failed_copy_restores_previous_install(self):
        self.install()
        before = m.files(self.target)
        (self.skill / 'data.txt').write_text('new')
        self.commit()
        with patch.object(m.shutil, 'copytree', side_effect=OSError('simulated disk failure')):
            with self.assertRaisesRegex(ValueError, 'restored=True'):
                self.install()
        self.assertEqual(before, m.files(self.target))

    def test_inventory_conflict_setup_and_external_archive(self):
        self.install()
        setup = self.home / 'skills' / 'prd-setup'
        setup.mkdir()
        (setup / 'SKILL.md').write_text('---\nname: prd-setup\ndescription: 配套\n---\n', encoding='utf-8')
        cfg = {'roots': [{'path': str(self.home / 'skills')} ]}
        self.assertFalse(m.inventory(cfg)['errors'])
        backup = self.home / 'skills' / 'prd.backup-test'
        shutil.copytree(self.target, backup)
        report = m.inventory(cfg)
        self.assertEqual(len(report['duplicates']), 1)
        self.assertIn(str(backup / 'SKILL.md'), report['duplicates'][0]['paths'])
        shutil.move(str(backup), str(self.root / 'external backup'))
        self.assertFalse(m.inventory(cfg)['errors'])
        self.assertTrue((self.root / 'external backup' / 'SKILL.md').exists())

    def test_namespace_scope_and_aliases(self):
        self.install()
        other = self.root / 'plugin'
        shutil.copytree(self.target, other)
        cfg = {'roots': [{'path': str(self.home / 'skills')}, {'path': str(other), 'namespace': 'plugin'}]}
        self.assertFalse(m.inventory(cfg)['errors'])
        alias = self.root / 'alias.txt'
        alias.write_text('Use $prd')
        cfg['aliases'] = [{'path': str(alias), 'target': str(self.target / 'SKILL.md'), 'expectedReference': '$prd'}]
        self.assertFalse(m.inventory(cfg)['errors'])
        alias.write_text('Use wrong entry')
        self.assertTrue(m.inventory(cfg)['errors'])

    def test_unmanaged_and_dirty_source_do_not_overwrite(self):
        self.target.mkdir(parents=True)
        (self.target / 'SKILL.md').write_text('custom')
        with self.assertRaisesRegex(ValueError, 'Unmanaged'):
            self.install()
        (self.skill / 'data.txt').write_text('uncommitted')
        with self.assertRaisesRegex(ValueError, 'commit source'):
            self.install()
        self.assertEqual((self.target / 'SKILL.md').read_text(), 'custom')

    def test_inventory_exit_code_and_missing_version(self):
        self.install()
        (self.target / m.RECORD).unlink()
        proc = subprocess.run(['powershell', '-NoProfile', '-File', str(Path(__file__).parents[1] / 'Test-SkillInventory.ps1'), '-LoadingRoots', str(self.home / 'skills'), '-FormalPath', str(self.target)], capture_output=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('errors', json.loads(proc.stdout.decode('utf-8-sig')))

    def test_inspected_junction_is_read_only_and_install_rejects_it(self):
        self.install()
        link = self.root / 'junction'
        env = dict(os.environ, SKILL_TEST_LINK=str(link), SKILL_TEST_TARGET=str(self.target))
        subprocess.run(['powershell', '-NoProfile', '-Command', 'New-Item -ItemType Junction -Path $env:SKILL_TEST_LINK -Target $env:SKILL_TEST_TARGET | Out-Null'], env=env, check=True, capture_output=True)
        cfg = {'roots': [{'path': str(link)}]}
        self.assertTrue(m.inventory(cfg)['errors'])
        cfg['resolvedLinks'] = {str(link): str(self.target)}
        self.assertFalse(m.inventory(cfg)['errors'])
        self.assertEqual(m.inventory(cfg)['entries'][0]['resolvedPath'], str((self.target / 'SKILL.md').resolve()))
        with self.assertRaisesRegex(ValueError, 'reparse'):
            m.no_links(link)

    def test_remote_entry_preserves_dirty_checkout(self):
        cache = self.root / 'cache'
        checkout = cache / 'repo'
        cache.mkdir()
        subprocess.run(['git', 'clone', str(self.repo), str(checkout)], check=True, capture_output=True)
        changed = checkout / 'skills' / 'prd' / 'data.txt'
        changed.write_text('user edit')
        entry = Path(__file__).parents[1] / 'install-from-git.ps1'
        p = subprocess.run(['powershell', '-NoProfile', '-File', str(entry), '-RepoUrl', str(self.repo), '-InstallRoot', str(cache), '-CodexHome', str(self.home)], capture_output=True)
        self.assertNotEqual(p.returncode, 0)
        self.assertEqual(changed.read_text(), 'user edit')
        self.assertFalse(self.target.exists())


if __name__ == '__main__':
    unittest.main()
