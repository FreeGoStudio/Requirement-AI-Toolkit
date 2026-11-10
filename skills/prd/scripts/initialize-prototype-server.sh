#!/bin/sh
# Called through SSH, as root or sudo. Own only the dedicated config and root.
set -eu
root=$1
port=$2
owner=$3
site=/etc/nginx/conf.d/prd-prototypes.conf
marker='# Managed by Requirement-AI-Toolkit'
command -v systemctl >/dev/null || { echo '需要 systemd'; exit 1; }
test "$(id -u)" = 0 || { echo '需要 root 或 sudo 权限'; exit 1; }
id "$owner" >/dev/null
if test -e "$root"; then
  test -f "$root/.prd-managed" || { echo '远程目录已存在且非本工具管理'; exit 1; }
fi
if test -e "$site"; then
  grep -qxF "$marker" "$site" || { echo '站点配置已存在且非本工具管理'; exit 1; }
fi
command -v ss >/dev/null || { echo '需要 ss 检查端口（iproute2/iproute）'; exit 1; }
if ss -ltnH "sport = :$port" | grep -q .; then
  test -f "$site" && grep -q "listen $port;" "$site" || { echo '网站端口已占用'; exit 1; }
  ss -ltnpH "sport = :$port" | grep -q nginx || { echo '网站端口被非 Nginx 进程占用'; exit 1; }
fi
if ! command -v nginx >/dev/null; then
  if command -v apt-get >/dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
  elif command -v dnf >/dev/null; then
    dnf install -y nginx
  else
    echo '仅支持 apt 或 dnf 自动安装'; exit 1
  fi
fi
nginx -t
# Ensure our drop-in will actually be loaded; do not rewrite an unrelated nginx.conf.
grep -Eq 'include[[:space:]]+/etc/nginx/conf.d/\*\.conf;' /etc/nginx/nginx.conf || { echo 'nginx.conf 未包含 conf.d/*.conf'; exit 1; }
backup=$(mktemp)
had_site=0
restored=0
activated=0
was_active=0
systemctl is-active --quiet nginx && was_active=1
if test -f "$site"; then cp "$site" "$backup"; had_site=1; fi
restore() {
  test "$restored" = 0 || return 0
  if test "$had_site" = 1; then cp "$backup" "$site"; else rm -f "$site"; fi
  rm -f "$backup"
  restored=1
  if test "$activated" = 1; then
    if test "$was_active" = 1; then systemctl reload nginx; else systemctl stop nginx; fi
  fi
}
trap 'restore' EXIT HUP INT TERM
mkdir -p "$root/releases" "$root/published"
touch "$root/.prd-managed"
chown "$owner" "$root" "$root/releases" "$root/published"
chmod 755 "$root" "$root/releases" "$root/published"
mkdir -p /etc/nginx/conf.d
cat > "$site" <<EOF
$marker
server {
    listen $port;
    server_name _;
    root $root/published;
    index index.html;
    autoindex off;
    charset utf-8;
    location / { try_files \$uri \$uri/ =404; }
    location ~ /\. { deny all; }
}
EOF
nginx -t
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl start nginx
fi
activated=1
systemctl enable nginx
trap - EXIT HUP INT TERM
rm -f "$backup"
echo "原型站点就绪，端口 $port；防火墙和云安全组由管理员检查。"
