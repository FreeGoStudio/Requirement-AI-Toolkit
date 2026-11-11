#!/bin/sh
# One-time administrator migration of the existing managed site. No reinitialization.
set -eu
root=${1:?remote root required}
prefix=${2:-}
site=/etc/nginx/conf.d/prd-prototypes.conf
test "$(id -u)" = 0 || { echo '需要管理员执行此一次性迁移'; exit 1; }
test -f "$root/.prd-managed"
grep -qx '# Managed by Requirement-AI-Toolkit' "$site"
nginx -t
backup=$(mktemp)
cp "$site" "$backup"
restore() {
    cp "$backup" "$site"
    nginx -t && systemctl reload nginx
    rm -f "$backup"
}
trap 'restore' EXIT
trap 'exit 1' HUP INT TERM
python3 - "$site" "$root" "$prefix" <<'PY'
from pathlib import Path
import re, sys
site, root, prefix = sys.argv[1:]
if not re.fullmatch(r'/(?:[a-zA-Z0-9_-]+/)+[a-zA-Z0-9_-]+', root):
    raise SystemExit('远程目录格式无效')
if not re.fullmatch(r'(?:/[A-Za-z0-9_-]+)*', prefix):
    raise SystemExit('访问前缀格式无效')
p = Path(site)
s = p.read_text()
anchor = f'    location {prefix}/ {{ alias {root}/published/; }}'
block = f'''    location = {prefix}/catalog/ {{
        alias {root}/published/;
        index .catalog-no-index;
        autoindex on;
        autoindex_format json;
        add_header Cache-Control "no-store" always;
        limit_except GET {{ deny all; }}
    }}
'''
if s.count(anchor) != 1:
    raise SystemExit('现有发布路径不匹配，未修改配置')
if block not in s:
    if f'location = {prefix}/catalog/' in s:
        raise SystemExit('目录接口已有不同配置，请管理员核对')
    p.write_text(s.replace(anchor, block + anchor))
PY
nginx -t
systemctl reload nginx
trap - EXIT HUP INT TERM
rm -f "$backup"
echo '目录接口已启用。请发布账号执行 -Action RefreshCatalog 安装动态汇总页。'
