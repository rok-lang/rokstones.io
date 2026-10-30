#!/usr/bin/env bash
# End-to-end test of `rok run -- serve`: a temp index (bare remote +
# checkout), a fake GitHub (tests/fake-github), logins through the OAuth
# callback, publish tokens, the API, and the commits pushed to the index.
#
#   tests/e2e.sh            (needs rok, rokc, git, curl on PATH)
#
# Everything lives in a temp directory, removed at the end.
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d "${TMPDIR:-/tmp}/rokstones-e2e.XXXXXX")
pids=()
cleanup() {
    for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
    rm -rf "$T"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; echo "--- server log" >&2; tail -30 "$T/server.log" >&2 || true; exit 1; }
ok() { echo "ok: $*"; }

(cd "$repo" && rok build >/dev/null)
(cd "$repo/tests/fake-github" && rok build >/dev/null)
bin="$repo/target/debug/rokstones_io"

gh_port=$((20000 + RANDOM % 5000))
port=$((25000 + RANDOM % 5000))
base="http://127.0.0.1:$port"

# The index: a bare remote and the server's checkout of it.
git init -q --bare "$T/remote.git"
git clone -q "$T/remote.git" "$T/index" 2>/dev/null
git -C "$T/index" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$T/index" push -q -u origin HEAD 2>/dev/null

# A site directory: the generator's inputs, output in $T/site/public.
mkdir -p "$T/site"
cp -R "$repo/static" "$repo/pages" "$T/site/"
mkdir -p "$T/site/og"
sed -e 's|^ *out: .*|    out: "public",|' "$repo/site.rokon" > "$T/site/site.rokon"

"$repo/tests/fake-github/target/debug/fake_github" "127.0.0.1:$gh_port" test-secret &
pids+=($!)

start_server() {
    (cd "$T/site" && exec env \
        ROKSTONES_URL="https://rokstones.test" \
        ROKSTONES_ADDR="127.0.0.1:$port" \
        GITHUB_CLIENT_ID="test-client" \
        GITHUB_CLIENT_SECRET="test-secret" \
        ROKSTONES_ADMINS="$1" \
        ROKSTONES_DATA="$T/data" \
        ROKSTONES_INDEX="$T/index" \
        GITHUB_OAUTH_URL="http://127.0.0.1:$gh_port" \
        GITHUB_API_URL="http://127.0.0.1:$gh_port" \
        GIT_CONFIG_COUNT=1 \
        GIT_CONFIG_KEY_0="url.file://$T/src/.insteadOf" \
        GIT_CONFIG_VALUE_0="https://example.invalid/" \
        "$bin" serve >>"$T/server.log" 2>&1) &
    server=$!
    pids+=($server)
    for _ in $(seq 50); do
        curl -s -o /dev/null "$base/login" && return 0
        sleep 0.1
    done
    fail "server did not start"
}

# req METHOD PATH [curl args..]: sets $code; headers in $T/h, body in $T/b.
req() {
    local m=$1 p=$2
    shift 2
    code=$(curl -s -X "$m" -D "$T/h" -o "$T/b" -w '%{http_code}' "$@" "$base$p")
}
header() { grep -i "^$1:" "$T/h" | head -1 | sed -e 's/^[^:]*: *//' -e 's/\r$//'; }
cookie_of() { grep -i "^set-cookie: $1=" "$T/h" | head -1 | sed -e "s/^[^=]*=//" -e 's/;.*//'; }
expect_code() { [ "$code" = "$1" ] || fail "$2: HTTP $code, want $1: $(head -c 300 "$T/b")"; }
expect_body() { grep -q -- "$1" "$T/b" || fail "$2: body lacks $1: $(head -c 300 "$T/b")"; }

# login CODE: logs in through the callback; sets $sess and $csrf.
login() {
    req GET /login
    expect_code 303 "login redirect"
    local loc state
    loc=$(header location)
    state=$(cookie_of rks_state)
    case "$loc" in
        "http://127.0.0.1:$gh_port/login/oauth/authorize?client_id=test-client&"*"state=$state&scope=read:user") ;;
        *) fail "authorize url: $loc" ;;
    esac
    header set-cookie | grep -q "HttpOnly; Secure; SameSite=Lax" || fail "state cookie flags"
    req GET "/auth/github/callback?code=$1&state=$state" -H "Cookie: rks_state=wrong"
    expect_code 400 "state mismatch"
    req GET "/auth/github/callback?code=$1&state=$state" -H "Cookie: rks_state=$state"
    expect_code 303 "callback"
    sess=$(cookie_of rks_session)
    [ ${#sess} = 64 ] || fail "session cookie"
    req GET /me -H "Cookie: rks_session=$sess"
    expect_code 200 "/me"
    csrf=$(sed -n 's/.*name="csrf" value="\([0-9a-f]*\)".*/\1/p' "$T/b" | head -1)
    [ -n "$csrf" ] || fail "no csrf token on /me"
}

start_server alice

# ---- static files ----
for _ in $(seq 100); do [ -f "$T/site/public/index.html" ] && break; sleep 0.2; done
req GET /
expect_code 200 "home page"
[ "$(header content-type)" = "text/html; charset=utf-8" ] || fail "html type"
req GET /style.css
[ "$(header content-type)" = "text/css; charset=utf-8" ] || fail "css type"
mkdir -p "$T/site/public/empty"
req GET /empty/
expect_code 301 "trailing slash"
[ "$(header location)" = "/empty" ] || fail "trailing slash location: $(header location)"
req GET /empty
expect_code 404 "no directory listing"
req GET "/index.html?a=1&b=2"
expect_code 301 "index.html"
[ "$(header location)" = "/?a=1&b=2" ] || fail "index.html location: $(header location)"
req GET /publishing.html
[ "$code" = 301 ] && [ "$(header location)" = "/publishing" ] || fail "publishing.html: $code $(header location)"
req GET /publishing
expect_code 200 "extensionless page"
code=$(curl -s -o /dev/null -w '%{http_code}' --path-as-is "$base/../site.rokon")
[ "$code" = 400 ] || [ "$code" = 404 ] || fail "path traversal: $code"
code=$(curl -s -o /dev/null -w '%{http_code}' --path-as-is "$base/%2e%2e/site.rokon")
[ "$code" = 404 ] || fail "encoded traversal: $code"
ok "static files"

# ---- logins ----
login user
expect_body "Publishing is not open yet" "non-admin page"
bob_sess=$sess bob_csrf=$csrf
req POST /me/tokens -H "Cookie: rks_session=$bob_sess" --data "csrf=$bob_csrf&name=x"
expect_code 403 "non-admin token"
expect_body "not open yet" "non-admin token message"
ok "non-admin cannot get a token"

login admin
expect_body "<strong>alice</strong>" "admin page"
req POST /me/tokens -H "Cookie: rks_session=$sess" --data "name=ci"
expect_code 403 "token without csrf"
req POST /me/tokens -H "Cookie: rks_session=$sess" --data "csrf=$bob_csrf&name=ci"
expect_code 403 "token with another session's csrf"
req POST /me/tokens -H "Cookie: rks_session=$sess" --data "csrf=$csrf&name=ci"
expect_code 200 "create token"
tok=$(grep -o 'rks_[0-9a-f]\{64\}' "$T/b" | head -1)
[ -n "$tok" ] || fail "token not shown"
grep -q "$tok" "$T/data/db.rokon" && fail "token stored in clear"
req GET /me -H "Cookie: rks_session=$sess"
grep -q "$tok" "$T/b" && fail "token shown twice"
expect_body "<td>ci</td>" "token listed"
ok "admin token"

# ---- API ----
auth=(-H "Authorization: Bearer $tok")
req GET /api/v1/me "${auth[@]}"
expect_code 200 "api me"
expect_body 'Me { login: "alice", publish: true }' "api me body"
req GET /api/v1/me -H "Authorization: Bearer rks_$(printf '0%.0s' $(seq 64))"
expect_code 401 "bad token"
expect_body 'Error { message:' "error body"
req POST /api/v1/me "${auth[@]}"
expect_code 405 "method"

# Stone sources: https://example.invalid/<name> is $T/src/<name> (the
# server's git config above). `geom` is a library, `app` is not.
source_repo() {
    mkdir -p "$T/src/$1/src"
    echo 'pub fn f() -> i32 { 1 }' > "$T/src/$1/src/$2"
    git -C "$T/src/$1" init -q
    git -C "$T/src/$1" add -A
    git -C "$T/src/$1" -c user.name=t -c user.email=t@t commit -q -m init
    git -C "$T/src/$1" rev-parse HEAD
}
rev=$(source_repo geom lib.rok)
tree=$(git -C "$T/src/geom" rev-parse "HEAD^{tree}")
app_rev=$(source_repo app main.rok)
line="Stone { name: \"geom\", vers: \"0.1.0\", deps: [], source: Dep::git(\"https://example.invalid/geom\", rev: \"$rev\"), cksum: \"$tree\", yanked: false }"
req POST /api/v1/publish "${auth[@]}" --data-binary "$line"
expect_code 200 "publish"
expect_body 'Published { name: "geom", vers: "0.1.0", file: "ge/om/geom" }' "publish body"
[ "$(git -C "$T/remote.git" log -1 --format=%s)" = "Publish geom 0.1.0" ] || fail "pushed commit"
[ "$(git -C "$T/remote.git" log -1 --format='%an <%ae>')" = "alice <1001+alice@users.noreply.github.com>" ] || fail "commit author"
[ "$(git -C "$T/remote.git" show HEAD:ge/om/geom)" = "$line" ] || fail "index line"
req POST /api/v1/publish "${auth[@]}" --data-binary "$line"
expect_code 409 "republish"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//\"geom\"/\"ge-om\"}"
expect_code 200 "second name"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//\"geom\"/\"ge_om\"}"
expect_code 409 "spelling conflict"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//https:/http:}"
expect_code 400 "http source"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//geom/Geom}"
expect_code 400 "name rule"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//yanked: false/yanked: false, x: 1}"
expect_code 400 "unknown field"
req POST /api/v1/publish --data-binary "$line"
expect_code 401 "no token"
app_line=${line//example.invalid\/geom/example.invalid\/app}
req POST /api/v1/publish "${auth[@]}" --data-binary "${app_line//$rev/$app_rev}"
expect_code 400 "not a library"
expect_body 'not a library package (no src/lib.rok)' "not a library body"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//$rev/$(printf 'cd%.0s' $(seq 20))}"
expect_code 400 "unfetchable source"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//cksum: \"$tree\"/cksum: \"$rev\"}"
expect_code 400 "cksum mismatch"
expect_body "cksum $rev is not the tree hash of commit $rev ($tree)" "cksum mismatch body"
h=$(printf 'ab%.0s' $(seq 32))
native="Native { name: \"zlib\", vers: \"1.3.1\", deps: {}, targets: { \"x86_64-unknown-linux-gnu\": Artifact { url: \"https://example.invalid/z.tar.gz\", sha256: \"$h\", links: { \"z\": \"static\" }, runtime: [] } }, yanked: false, license: \"Zlib\" }"
req POST /api/v1/publish "${auth[@]}" --data-binary "$native"
expect_code 200 "publish native"
[ "$(git -C "$T/remote.git" show HEAD:native/zl/ib/zlib)" = "$native" ] || fail "native line"
ok "publish"

req POST /api/v1/yank "${auth[@]}" --data-binary 'Yank { name: "geom", vers: "0.1.0" }'
expect_code 200 "yank"
expect_body 'Yanked { name: "geom", vers: "0.1.0", yanked: true }' "yank body"
[ "$(git -C "$T/remote.git" log -1 --format=%s)" = "Yank geom 0.1.0" ] || fail "yank commit"
git -C "$T/remote.git" show HEAD:ge/om/geom | grep -q 'yanked: true' || fail "yanked line"
req POST /api/v1/yank "${auth[@]}" --data-binary 'Yank { name: "geom", vers: "0.1.0", undo: true, native: false }'
expect_code 200 "unyank"
[ "$(git -C "$T/remote.git" log -1 --format=%s)" = "Unyank geom 0.1.0" ] || fail "unyank commit"
[ "$(git -C "$T/remote.git" show HEAD:ge/om/geom)" = "$line" ] || fail "unyanked line"
req POST /api/v1/yank "${auth[@]}" --data-binary 'Yank { name: "zlib", vers: "1.3.1", native: true }'
[ "$(git -C "$T/remote.git" log -1 --format=%s)" = "Yank native zlib 1.3.1" ] || fail "native yank commit"
req POST /api/v1/yank "${auth[@]}" --data-binary 'Yank { name: "geom", vers: "9.9.9" }'
expect_code 404 "yank unknown"
ok "yank"

# A rejected push: 503, and the checkout back at the remote's state.
printf '#!/bin/sh\nexit 1\n' > "$T/remote.git/hooks/pre-receive"
chmod +x "$T/remote.git/hooks/pre-receive"
before=$(git -C "$T/remote.git" rev-parse HEAD)
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//0.1.0/0.2.0}"
expect_code 503 "push refused"
[ "$(git -C "$T/index" rev-parse HEAD)" = "$before" ] || fail "checkout not reset"
[ -z "$(git -C "$T/index" status --porcelain)" ] || fail "checkout dirty"
rm "$T/remote.git/hooks/pre-receive"
ok "push failure"

# The site follows the index.
for _ in $(seq 100); do [ -f "$T/site/public/stones/geom.html" ] && break; sleep 0.2; done
req GET /stones/geom
expect_code 200 "stone page after publish"
ok "site rebuilt"

# Revoking a token, and logging out.
req GET /me -H "Cookie: rks_session=$sess"
tid=$(sed -n 's|.*action="/me/tokens/\([0-9a-f]*\)/revoke".*|\1|p' "$T/b" | head -1)
[ -n "$tid" ] || fail "no revoke form"

# Removing alice from the admins takes her power at once.
kill "$server"; wait "$server" 2>/dev/null || true
start_server bob
req GET /api/v1/me "${auth[@]}"
expect_body 'publish: false' "demoted"
req POST /api/v1/publish "${auth[@]}" --data-binary "${line//0.1.0/0.3.0}"
expect_code 403 "demoted publish"
kill "$server"; wait "$server" 2>/dev/null || true
start_server alice

req POST "/me/tokens/$tid/revoke" -H "Cookie: rks_session=$sess" --data "csrf=$csrf"
expect_code 303 "revoke"
req GET /api/v1/me "${auth[@]}"
expect_code 401 "revoked token"
req POST /logout -H "Cookie: rks_session=$sess" --data "csrf=$csrf"
expect_code 303 "logout"
req GET /me -H "Cookie: rks_session=$sess"
expect_code 303 "logged out"
ok "revoke and logout"

grep -q "code=" "$T/server.log" && fail "OAuth code in the log"
grep -q "test-secret\|gho_" "$T/server.log" && fail "secret in the log"
echo "all e2e checks passed"
