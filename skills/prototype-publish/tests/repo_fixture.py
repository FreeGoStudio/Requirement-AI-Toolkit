import json
import subprocess
from pathlib import Path


def command(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, check=True)
    return result.stdout.decode().strip()


def create_project(base):
    repo = Path(base) / 'repository'
    repo.mkdir()
    command(repo, 'init', '-q', '-b', 'requirement/demo')
    command(repo, 'config', 'user.name', 'Test')
    command(repo, 'config', 'user.email', 'test@example.invalid')
    command(repo, 'config', 'core.autocrlf', 'false')
    root = repo / 'working/demo'
    root.mkdir(parents=True)
    prd = repo / 'docs/requirements/demo/index.md'
    prd.parent.mkdir(parents=True)
    prd.write_text('业务规则保持不变。\n<!-- prototype-links:begin -->\n待发布\n<!-- prototype-links:end -->\n正文结束。\n', encoding='utf-8')
    (repo / '.gitignore').write_text('**/.prototype-publication.json\n', encoding='utf-8')
    project = {'schemaVersion': 2, 'requirementId': 'demo', 'publicationId': 'a'*32,
               'repository': '', 'siteSource': 'docs', 'prdPath': 'docs/requirements/demo/index.md',
               'documents': [{'path': 'docs/requirements/demo/index.md'}],
               'publicationTarget': {'host': 'example.test', 'remoteRoot': '/var/www/prd-prototypes', 'baseUrl': 'http://example.test:8080'}}
    (root / 'requirement.json').write_text(json.dumps(project), encoding='utf-8')
    (root / '12-high-fidelity-prototype-spec.json').write_text('{}', encoding='utf-8')
    return repo, root


def push_project(repo, root, base):
    remote = Path(base) / 'remote.git'
    subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
    command(repo, 'remote', 'add', 'origin', str(remote))
    p = root / 'requirement.json'
    data = json.loads(p.read_text()); data['repository'] = str(remote)
    p.write_text(json.dumps(data), encoding='utf-8')
    command(repo, 'add', '.')
    command(repo, 'commit', '-qm', 'source')
    command(repo, 'push', '-q', '-u', 'origin', 'HEAD')
    return command(repo, 'rev-parse', 'HEAD')
