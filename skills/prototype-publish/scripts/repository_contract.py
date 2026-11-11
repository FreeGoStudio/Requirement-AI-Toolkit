"""Portable PRD identity and Git-backed source verification (no credentials stored)."""
import json
import hashlib
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit


class ContractError(ValueError):
    pass


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, timeout=60)
    if result.returncode:
        # Git stderr may contain a credential-bearing remote URL.
        raise ContractError('Git 检查失败；请检查仓库、分支及认证状态，不输出凭据。')
    return result.stdout.decode('utf-8').strip()


def repo_path(repo, value, exists=True):
    if not isinstance(value, str) or not value or value.startswith('/') or any(c in value for c in ('\\', ':', '?', '#')) or any(x in ('', '.', '..') for x in value.split('/')):
        raise ContractError('需要规范的仓库根目录相对路径：' + str(value))
    path = (repo / value).resolve()
    if not path.is_relative_to(repo) or (exists and not path.is_file()):
        raise ContractError('仓库引用缺失或越界：' + value)
    return path


def load_project(root):
    root = Path(root).resolve()
    descriptor = root / 'requirement.json'
    if not descriptor.is_file():
        raise ContractError('缺少 requirement.json；旧项目请先要求 AI 迁移。')
    data = json.loads(descriptor.read_text(encoding='utf-8-sig'))
    if data.get('schemaVersion') != 2:
        raise ContractError('旧需求配置不再兼容，请先要求 AI 迁移。')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', data.get('requirementId', '')) or not re.fullmatch(r'[a-f0-9]{32}', data.get('publicationId', '')):
        raise ContractError('无效的需求标识或固定发布标识。')
    repository = urlsplit(data.get('repository', ''))
    if repository.password or repository.query or (repository.scheme in ('http', 'https') and repository.username):
        raise ContractError('仓库地址不得包含凭据。')
    for other in root.parent.glob('*/requirement.json'):
        if other.resolve() != descriptor.resolve():
            other_data = json.loads(other.read_text(encoding='utf-8-sig'))
            if other_data.get('publicationId') == data['publicationId']:
                raise ContractError('不同需求不能共用发布标识；新需求必须创建新 ID。')
    repo = Path(git(root, 'rev-parse', '--show-toplevel')).resolve()
    site = repo_path(repo, data['siteSource'], exists=False)
    if root == repo or root.is_relative_to(site) or site.is_relative_to(root):
        raise ContractError('需求工作目录必须在 VitePress 源目录之外。')
    prd = repo_path(repo, data['prdPath'], exists=False)
    if not prd.is_relative_to(site) or prd.suffix != '.md':
        raise ContractError('正式 PRD 必须位于 VitePress 源目录中。')
    documents = data.get('documents', [])
    if len({d['path'] for d in documents}) != len(documents):
        raise ContractError('文档登记重复。')
    for doc in documents:
        path = repo_path(repo, doc['path'])
        if path.suffix != '.md' or not (path == prd or path.is_relative_to(root)):
            raise ContractError('只能登记本需求 Markdown 或正式 PRD。')
    return repo, root, data


def read_manifest(root):
    repo, root, project = load_project(root)
    manifest = json.loads((root / '03-html-design-manifest.json').read_text(encoding='utf-8-sig'))
    if manifest.get('schemaVersion') != 2:
        raise ContractError('旧清单不再兼容，请先要求 AI 迁移。')
    for flow in manifest.get('flows', []):
        if set(flow.get('entries', {})) - {'high'}:
            raise ContractError('旧低保真或未知入口不再支持，请先要求 AI 迁移。')
        entry = flow.get('entries', {}).get('high')
        if entry:
            path = repo_path(repo, entry)
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', flow['flowId']) or path != root / 'prototypes/high' / (flow['flowId'] + '.html'):
                raise ContractError('原型入口与需求目录不匹配。')
    return repo, root, project, manifest


def verify_pushed_source(root, package_paths, config):
    repo, root, project = load_project(root)
    target = project.get('publicationTarget', {})
    if any(target.get(k, '').rstrip('/') != str(config.get(k, '')).rstrip('/') for k in ('host', 'remoteRoot', 'baseUrl')):
        raise ContractError('发布目标与仓库登记不一致；请先核对目标并提交更新，禁止隐式切换。')
    remote = git(repo, 'remote', 'get-url', 'origin')
    if remote != project.get('repository'):
        raise ContractError('origin 与需求配置的仓库不一致；复制为新需求需创建新发布标识。')
    branch = git(repo, 'symbolic-ref', '--short', 'HEAD')
    commit = git(repo, 'rev-parse', 'HEAD')
    remote_ref = git(repo, 'ls-remote', '--exit-code', 'origin', 'refs/heads/' + branch)
    if not remote_ref or remote_ref.split()[0] != commit:
        raise ContractError('当前源码提交尚未推送，或远端分支已变化；先同步并推送，本次不发布。')
    # Only ignored machine state may remain uncommitted in this requirement.
    scope = root.relative_to(repo).as_posix()
    if git(repo, 'status', '--porcelain', '--untracked-files=all', '--', scope, project['prdPath']):
        raise ContractError('本需求存在未提交文件；请先验证、提交并推送，再发布。')
    required = set(package_paths) | {'requirement.json', '03-html-design-manifest.json', '12-high-fidelity-prototype-spec.json'}
    for rel in required:
        path = (root / rel).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ContractError('发布源码缺失或越界：' + rel)
        if isinstance(package_paths, dict) and rel in package_paths and hashlib.sha256(path.read_bytes()).hexdigest() != package_paths[rel]:
            raise ContractError('打包期间源码发生变化，请重新验证：' + rel)
        tracked = path.relative_to(repo).as_posix()
        actual = git(repo, 'hash-object', '--path=' + tracked, str(path))
        committed = git(repo, 'rev-parse', commit + ':' + tracked)
        if actual != committed:
            raise ContractError('发布内容不等于已推送版本：' + tracked)
    return commit
