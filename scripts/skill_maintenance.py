"""Scoped read-only inventory and Git-to-skill installation. Python 3.10+, PyYAML, Git."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
import yaml

REPO = Path(__file__).resolve().parent.parent
RECORD = '.skill-install.json'


def git(repo, *args, binary=False):
    p = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if p.returncode:
        raise ValueError(p.stderr.decode('utf-8', errors='replace'))
    return p.stdout if binary else p.stdout.decode('utf-8').strip()


def no_links(path):
    path = Path(os.path.abspath(path))
    for p in [path, *path.parents]:
        if p.exists() or p.is_symlink():
            info = p.lstat()
            if p.is_symlink() or getattr(info, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise ValueError(f'Link/reparse point requires review: {p}')
    return path


def files(path):
    result = {}
    no_links(path)
    for parent, dirs, names in os.walk(path, followlinks=False):
        for name in dirs + names:
            no_links(Path(parent) / name)
        for name in names:
            p = Path(parent) / name
            rel = p.relative_to(path).as_posix()
            if rel != RECORD:
                result[rel] = p.read_bytes()
    return result


def hashes(data):
    return {k: hashlib.sha256(v).hexdigest() for k, v in sorted(data.items())}


def metadata(data):
    match = re.match(r'\A---\s*\r?\n(.*?)\r?\n---(?:\s*\r?\n|\s*$)', data.decode('utf-8-sig'), re.S)
    if not match:
        raise ValueError('Missing YAML frontmatter')
    doc = yaml.safe_load(match.group(1))
    if not isinstance(doc, dict) or not all(isinstance(doc.get(k), str) and doc[k].strip() for k in ['name', 'description']):
        raise ValueError('Missing name or description')
    return doc


def source(repo, revision, skill):
    commit = git(repo, 'rev-parse', '--verify', revision + '^{commit}')
    prefix = f'skills/{skill}/'
    result = {}
    for line in git(repo, 'ls-tree', '-rz', commit, '--', prefix, binary=True).split(b'\0'):
        if not line:
            continue
        info, name = line.split(b'\t', 1)
        mode, kind, oid = info.split()
        if kind != b'blob' or mode not in (b'100644', b'100755'):
            raise ValueError('Source contains symlink or submodule')
        result[name.decode('utf-8')[len(prefix):]] = git(repo, 'cat-file', 'blob', oid.decode(), binary=True)
    if metadata(result.get('SKILL.md', b''))['name'] != skill:
        raise ValueError('SKILL.md name differs from requested skill')
    return commit, result


def validate(data, skill):
    if metadata(data.get('SKILL.md', b''))['name'] != skill:
        raise ValueError('SKILL.md name mismatch')
    with tempfile.TemporaryDirectory(prefix='skill-validate-') as temp:
        for name, content in data.items():
            if name.startswith('/') or '..' in Path(name).parts or ':' in name or name == RECORD:
                raise ValueError(f'Invalid package path: {name}')
            if name.endswith('.py'):
                compile(content, name, 'exec')
            if name.endswith('.ps1'):
                p = Path(temp) / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(content)
        env = dict(os.environ, SKILL_VALIDATE_ROOT=temp)
        command = "$bad=$false; Get-ChildItem -LiteralPath $env:SKILL_VALIDATE_ROOT -Filter *.ps1 -Recurse | ForEach-Object { $t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$t,[ref]$e); if($e){$e | Out-String | Write-Output; $bad=$true} }; if($bad){exit 1}"
        p = subprocess.run(['powershell', '-NoProfile', '-Command', command], env=env, capture_output=True)
        if p.returncode:
            raise ValueError('PowerShell validation failed: ' + p.stdout.decode(errors='replace'))


def equivalent(a, b):
    return a == b or (a is not None and b is not None and b'\0' not in a + b and a.replace(b'\r\n', b'\n') == b.replace(b'\r\n', b'\n'))


def merge(base, local, incoming):
    result, conflicts, changes = {}, [], []
    for name in sorted(base.keys() | local.keys() | incoming.keys()):
        b, l, n = base.get(name), local.get(name), incoming.get(name)
        if not equivalent(l, b):
            changes.append(name)
        if equivalent(l, b):
            value = n
        elif equivalent(n, b) or equivalent(l, n):
            value = l
        elif b is not None and l is not None and n is not None and b'\0' not in b + l + n:
            with tempfile.TemporaryDirectory(prefix='skill-merge-') as temp:
                paths = [Path(temp) / x for x in ['local', 'base', 'incoming']]
                for p, content in zip(paths, [l, b, n]):
                    p.write_bytes(content.replace(b'\r\n', b'\n'))
                proc = subprocess.run(['git', 'merge-file', '-p', *map(str, paths)], capture_output=True)
                if proc.returncode:
                    conflicts.append(name)
                value = proc.stdout
        else:
            conflicts.append(name)
            value = None
        if value is not None:
            result[name] = value
    print(json.dumps({'localChanges': changes, 'conflicts': conflicts}, ensure_ascii=False), file=sys.stderr)
    if conflicts:
        raise ValueError('Conflicting edits; reconcile in source repository: ' + ', '.join(conflicts))
    return result


def config(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig')) if path else {}


def scan_path(path, cfg):
    """Read-only traversal permits only explicitly inspected junction destinations."""
    for p in [path, *path.parents]:
        if p.exists() or p.is_symlink():
            info = p.lstat()
            if p.is_symlink() or getattr(info, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                expected = cfg.get('resolvedLinks', {}).get(str(p))
                if not expected or Path(expected).resolve() != p.resolve():
                    raise ValueError(f'Unreviewed link/reparse point: {p} -> {p.resolve()}')
    return path.resolve()


def inventory(cfg):
    entries, errors, scanned, versions, seen = [], [], [], [], set()
    session = {str(Path(x)).lower() for x in cfg.get('sessionPaths', [])}
    for root in cfg.get('roots', []):
        p = Path(root['path']).absolute()
        scanned.append({**root, 'exists': p.exists()})
        if not p.exists():
            if root.get('required', True):
                errors.append(f'Loading root missing: {p}')
            continue
        try:
            scan_path(p, cfg)
            visited = set()
            def walk_error(error):
                raise error
            for parent, dirs, names in os.walk(p, followlinks=True, onerror=walk_error):
                actual = Path(parent).resolve()
                if actual in visited:
                    dirs[:] = []
                    errors.append(f'Repeated/cyclic directory: {parent}')
                    continue
                visited.add(actual)
                for d in list(dirs):
                    try:
                        scan_path(Path(parent) / d, cfg)
                    except ValueError as exc:
                        errors.append(str(exc))
                        dirs.remove(d)
                for name in names:
                    if name.lower() != 'skill.md':
                        continue
                    f = Path(parent) / name
                    key = (str(f).lower(), root.get('namespace', ''), root.get('scope', 'session'))
                    if key in seen:
                        continue
                    seen.add(key)
                    try:
                        actual_file = scan_path(f, cfg)
                        md = metadata(f.read_bytes())
                        backup = any(re.search(r'(?i)(?:backup|bak|\.old)(?:[-_.]|$)', part) for part in f.relative_to(p).parts[:-1])
                        entries.append({'path': str(f), 'resolvedPath': str(actual_file), 'name': md['name'], 'description': md['description'], 'source': root.get('source', 'explicit'), 'namespace': root.get('namespace', ''), 'scope': root.get('scope', 'session'), 'sha256': hashlib.sha256(f.read_bytes()).hexdigest(), 'sessionDiscovered': str(f).lower() in session, 'backup': backup})
                        if backup:
                            errors.append(f'Backup in loading root: {f}')
                    except (ValueError, OSError, yaml.YAMLError) as exc:
                        errors.append(f'{f}: {exc}')
        except (ValueError, OSError) as exc:
            errors.append(f'{p}: {exc}')
    grouped = {}
    for e in entries:
        grouped.setdefault((e['namespace'], e['scope'], e['name']), []).append(e['path'])
    duplicates = [dict(namespace=k[0], scope=k[1], name=k[2], paths=v) for k, v in grouped.items() if len(v) > 1]
    errors.extend(f'Duplicate: {d}' for d in duplicates)
    for formal in cfg.get('formal', []):
        p = Path(formal)
        try:
            current = files(p)
            metadata(current.get('SKILL.md', b''))
            record = json.loads((p / RECORD).read_text(encoding='utf-8'))
            _, upstream = source(Path(record['repository']), record['commit'], record['skill'])
            if hashes(upstream) != record['upstreamHashes'] or hashes(current) != record['installedHashes']:
                raise ValueError('Installed files or recorded source hashes differ')
            versions.append({'path': str(p), 'commit': record['commit'], 'localChanges': record['localChanges']})
        except (ValueError, OSError, KeyError) as exc:
            errors.append(f'Formal entry {p}: {exc}')
    for alias in cfg.get('aliases', []):
        p, target = Path(alias['path']), Path(alias['target'])
        try:
            metadata(target.read_bytes())
            if alias['expectedReference'] not in p.read_text(encoding='utf-8-sig'):
                raise ValueError('Declared forwarding reference missing')
        except (ValueError, OSError) as exc:
            errors.append(f'Alias {p}: {exc}')
    return {'roots': scanned, 'entries': entries, 'duplicates': duplicates, 'versions': versions, 'errors': errors, 'summary': '检查通过（仅限所列文件来源；应用发现结果需新聊天验证）' if not errors else f'检查失败：{len(errors)} 项，请查看 errors。'}


def write_tree(path, data, record=None):
    path.mkdir(parents=True, exist_ok=True)
    for name, content in data.items():
        p = path / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(content)
    if record is not None:
        (path / RECORD).write_bytes(record)


def install(repo, codex_home, skill, revision='HEAD', baseline=None, cfg=None):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', skill):
        raise ValueError('Invalid skill name')
    repo, codex_home = no_links(repo), no_links(codex_home)
    root, history = no_links(codex_home / 'skills'), no_links(codex_home / 'skill-history')
    target = no_links(root / skill)
    for loading in [root, Path.home() / '.agents' / 'skills'] + [Path(x['path']) for x in (cfg or {}).get('roots', [])]:
        loading = no_links(loading)
        if history == loading or loading in history.parents:
            raise ValueError(f'History inside loading root: {loading}')
    dirty = git(repo, 'status', '--porcelain', '--untracked-files=all', '--', f'skills/{skill}')
    if dirty:
        raise ValueError('Validate and commit source changes before installation:\n' + dirty)
    commit, incoming = source(repo, revision, skill)
    existed = target.exists()
    old = files(target)
    old_record = (target / RECORD).read_bytes() if (target / RECORD).exists() else None
    if existed:
        if old_record:
            record = json.loads(old_record)
            _, base = source(Path(record['repository']), record['commit'], skill)
        else:
            _, base = source(repo, baseline or revision, skill)
            if not baseline and (set(old) != set(base) or any(not equivalent(old[k], base[k]) for k in old)):
                raise ValueError('Unmanaged installation differs. Supply verified -BaselineRevision before merging.')
        candidate = merge(base, old, incoming)
    else:
        candidate = incoming
    validate(candidate, skill)
    # Preserve identical installed bytes (including checkout line endings).
    for name in candidate.keys() & old.keys():
        if equivalent(candidate[name], old[name]):
            candidate[name] = old[name]
    history.mkdir(parents=True, exist_ok=True)
    backup = history / (skill + '-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8] + '.zip')
    record = {'schema': 1, 'skill': skill, 'repository': str(repo), 'commit': commit, 'upstreamHashes': hashes(incoming), 'installedHashes': hashes(candidate), 'localChanges': [k for k in sorted(candidate.keys() | incoming.keys()) if not equivalent(candidate.get(k), incoming.get(k))], 'recoveryArchive': str(backup) if existed else None}
    encoded = json.dumps(record, ensure_ascii=False, indent=2).encode('utf-8')
    with tempfile.TemporaryDirectory(prefix='skill-release-') as temp:
        stage = Path(temp) / skill
        write_tree(stage, candidate, encoded)
        if files(target) != old or target.exists() != existed or ((target / RECORD).read_bytes() if (target / RECORD).exists() else None) != old_record:
            raise ValueError('Installation changed during validation; target not replaced')
        if existed:
            with zipfile.ZipFile(backup, 'x', zipfile.ZIP_DEFLATED) as z:
                for name, data in old.items():
                    z.writestr(name, data)
                if old_record:
                    z.writestr(RECORD, old_record)
            with zipfile.ZipFile(backup) as z:
                if z.testzip() or any(z.read(k) != v for k, v in old.items()):
                    raise ValueError('Recovery archive verification failed; target unchanged')
        try:
            no_links(target)
            if target.parent != root or target.name != skill:
                raise ValueError('Unexpected deletion target')
            if existed:
                shutil.rmtree(target)
            root.mkdir(parents=True, exist_ok=True)
            shutil.copytree(stage, target)
            if hashes(files(target)) != hashes(candidate):
                raise ValueError('Post-install hash mismatch')
        except Exception as exc:
            try:
                no_links(target)
                if target.exists():
                    shutil.rmtree(target)
                if existed:
                    write_tree(target, old, old_record)
                restored = files(target) == old
            except Exception:
                restored = False
            raise ValueError(f'Update failed: {exc}; restored={restored}; target={target}; recovery={backup}') from exc
    return {'target': str(target), 'commit': commit, 'recoveryArchive': record['recoveryArchive'], 'localChanges': record['localChanges']}


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='action', required=True)
    scan = sub.add_parser('inventory')
    scan.add_argument('--config')
    scan.add_argument('--root', action='append', default=[])
    scan.add_argument('--formal')
    release = sub.add_parser('install')
    release.add_argument('--skill', default='prd')
    release.add_argument('--codex-home', required=True)
    release.add_argument('--revision', default='HEAD')
    release.add_argument('--baseline')
    release.add_argument('--config')
    args = parser.parse_args()
    cfg = config(args.config)
    if args.action == 'inventory':
        cfg.setdefault('roots', []).extend({'path': p} for p in args.root)
        if not cfg['roots']:
            parser.error('Explicit loading roots/config required; no claim of global coverage.')
        if args.formal:
            cfg.setdefault('formal', []).append(args.formal)
        report = inventory(cfg)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(report['summary'], file=sys.stderr)
        return bool(report['errors'])
    print(json.dumps(install(REPO, Path(args.codex_home), args.skill, args.revision, args.baseline, cfg), ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    try:
        sys.exit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
