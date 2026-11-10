#!/bin/sh
# Runs the real initializer with an isolated filesystem and mocked system services.
set -eu
source_script=$1
sandbox=$(mktemp -d)
trap 'rm -rf "$sandbox"' EXIT
mkdir -p "$sandbox/bin" "$sandbox/nginx/conf.d"
export PRD_TEST_SANDBOX="$sandbox"
export PATH="$sandbox/bin:$PATH"
cat > "$sandbox/bin/id" <<'EOF'
#!/bin/sh
if test "${1:-}" = '-u'; then echo 0; fi
EOF
cat > "$sandbox/bin/chown" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$sandbox/bin/ss" <<'EOF'
#!/bin/sh
if test "${PRD_OCCUPIED:-0}" = 1; then echo 'LISTEN foreign'; fi
EOF
cat > "$sandbox/bin/systemctl" <<'EOF'
#!/bin/sh
if test "$1" = 'is-active'; then exit 0; fi
if test "$1" = 'reload' && test "${PRD_FAIL_RELOAD:-0}" = 1; then exit 1; fi
echo "$*" >> "$PRD_TEST_SANDBOX/service.log"
EOF
cat > "$sandbox/bin/nginx" <<'EOF'
#!/bin/sh
if test "${PRD_FAIL_TEST:-0}" = 1 && test -f "$PRD_TEST_SANDBOX/nginx/conf.d/prd-prototypes.conf" && grep -q 'listen 8080;' "$PRD_TEST_SANDBOX/nginx/conf.d/prd-prototypes.conf"; then exit 1; fi
exit 0
EOF
chmod +x "$sandbox/bin/"*
# Replace only the /etc/nginx test location; execute all other production logic unchanged.
sed "s|/etc/nginx|$sandbox/nginx|g" "$source_script" > "$sandbox/initialize.sh"
echo "include $sandbox/nginx/conf.d/*.conf;" > "$sandbox/nginx/nginx.conf"
site="$sandbox/nginx/conf.d/prd-prototypes.conf"
echo '# unrelated site' > "$site"
if sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester; then echo 'FAIL: overwrote unrelated config'; exit 1; fi
grep -qx '# unrelated site' "$site"
rm "$site"
export PRD_OCCUPIED=1
if sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester; then echo 'FAIL: accepted occupied port'; exit 1; fi
unset PRD_OCCUPIED
test ! -e "$site"
export PRD_FAIL_TEST=1
if sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester; then echo 'FAIL: accepted bad config'; exit 1; fi
test ! -e "$site"
unset PRD_FAIL_TEST
sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester
grep -q 'listen 8080;' "$site"
test -d "$sandbox/site/published"
cp "$site" "$sandbox/saved.conf"
export PRD_FAIL_RELOAD=1
if sh "$sandbox/initialize.sh" "$sandbox/site" 8081 tester; then echo 'FAIL: accepted failed reload'; exit 1; fi
cmp "$site" "$sandbox/saved.conf"
unset PRD_FAIL_RELOAD
sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester
cmp "$site" "$sandbox/saved.conf"
sh "$sandbox/initialize.sh" "$sandbox/site" 8080 tester /_tmp/prototypes
grep -q 'location /_tmp/prototypes/ { alias ' "$site"
grep -q 'location / { return 404; }' "$site"
grep -q 'location = /_tmp/prototypes { return 301 /_tmp/prototypes/; }' "$site"
echo 'PASS: unrelated config protection, occupied port, failed config/reload restoration, idempotent initialization.'
