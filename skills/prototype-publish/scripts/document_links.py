"""Update explicit Markdown prototype blocks; never rewrite business prose."""
import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import quote, urlencode
from repository_contract import read_manifest, repo_path, ContractError

BEGIN = '<!-- prototype-links:begin -->'
END = '<!-- prototype-links:end -->'


def sync_document_links(root, state=None, pending=False, check=False):
    persist_pending = state is None
    repo, root, project, manifest = read_manifest(root)
    if state is None:
        state_path = root / '.prototype-publication.json'
        state = json.loads(state_path.read_text(encoding='utf-8-sig')) if state_path.exists() else {}
    success = state.get('lastSuccess', {})
    published = (not pending and state.get('publicationId') == project['publicationId']
                 and state.get('lastAttempt', {}).get('status') == 'published'
                 and bool(success.get('url')) and bool(success.get('sourceCommit')))
    flows = {f['flowId']: f for f in manifest['flows'] if f['entries'].get('high')}
    changes = []
    for doc in project['documents']:
        path = repo_path(repo, doc['path'])
        raw = path.read_bytes()
        text = raw.decode('utf-8')
        if text.count(BEGIN) != 1 or text.count(END) != 1 or text.index(BEGIN) > text.index(END):
            raise ContractError('文档需有唯一的原型链接标记区：' + doc['path'])
        lines = ['原型状态：' + ('已发布' if published else '本次待发布；当前服务器内容不代表本次版本。')]
        if published:
            lines += ['源码提交：`' + success['sourceCommit'] + '`', '发布版本：`' + success.get('version', '') + '`']
        for link in doc.get('links', [{'flowId': f, 'label': flows[f]['flowName']} for f in flows]):
            flow = flows.get(link['flowId'])
            if not flow:
                raise ContractError('文档引用未登记原型流程：' + link['flowId'])
            label = str(link.get('label', flow['flowName']))
            label = re.sub(r'[\r\n]', ' ', label).replace('\\', '\\\\').replace('[', '\\[').replace(']', '\\]')
            if published:
                entry = repo_path(repo, flow['entries']['high']).relative_to(root).as_posix()
                url = success['url'].rstrip('/') + '/' + quote(entry, safe='/')
                if link.get('query'):
                    url += '?' + urlencode(link['query'])
                if link.get('fragment'):
                    url += '#' + quote(link['fragment'], safe='-._~')
                lines.append('- [' + label + '](' + url + ')')
            else:
                lines.append('- ' + label + '：待发布')
        newline = '\r\n' if '\r\n' in text else '\n'
        start = text.index(BEGIN) + len(BEGIN)
        end = text.index(END)
        updated = text[:start] + newline + newline.join(lines) + newline + text[end:]
        if updated != text:
            changes.append((path, updated.encode('utf-8')))
    # Validate every registered block before writing any of them.
    if pending and not check and persist_pending:
        state = dict(state, publicationId=project['publicationId'], lastAttempt={'status':'pending'})
        state_path = root / '.prototype-publication.json'
        temporary = root / '.prototype-publication.links.tmp'
        temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temporary, state_path)
    if not check:
        for path, content in changes:
            path.write_bytes(content)
    return len(changes)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--pending', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    count = sync_document_links(args.root, pending=args.pending, check=args.check)
    print(f'Validated Markdown prototype blocks; changes: {count}')
