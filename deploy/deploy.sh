#!/bin/sh
# Ship the rokstones API backend and (re)start it. The static site goes
# to Cloudflare Pages (deploy/cloudflare); this is only the dynamic API.
# Infrastructure is deploy/terraform. Nothing here runs until you call it.
#
#   deploy/deploy.sh <ubuntu@ip>
#
# Prepare on the server first, once:
#   - /srv/rokstones/.env   (from .env.example, with the OAuth app and admins)
#   - /var/lib/rokstones/rokstones.io-index  (a git checkout of the public
#     index, tracking origin/main, with a deploy key that can push)
# The server binary is built here with `rok build --release`.
set -eu
[ $# -eq 1 ] || { echo "usage: deploy.sh <ubuntu@ip>" >&2; exit 2; }
host=$1
here=$(cd "$(dirname "$0")/.." && pwd)
bin=$here/target/release/rokstones_io
[ -x "$bin" ] || { echo "build first: (cd $here && rok build --release)" >&2; exit 1; }

# The server serves static pages from its own public/ for routes
# Cloudflare does not; ship a built copy too.
[ -d "$here/public" ] || { echo "build the site first: (cd $here && rok run)" >&2; exit 1; }

ssh "$host" "sudo install -d -o rokstones -g rokstones /srv/rokstones"
rsync -a "$bin" "$host:/tmp/rokstones_io"
rsync -a --delete "$here/public/" "$host:/tmp/rokstones-public/"
rsync -a "$here/deploy/rokstones.service" "$host:/tmp/rokstones.service"
rsync -a "$here/site.rokon" "$host:/tmp/rokstones-site.rokon"
ssh "$host" "sudo sh -s" <<'REMOTE'
set -eu
install -o rokstones -g rokstones /tmp/rokstones_io /srv/rokstones/rokstones_io
install -o rokstones -g rokstones /tmp/rokstones-site.rokon /srv/rokstones/site.rokon
rm -rf /srv/rokstones/public && mv /tmp/rokstones-public /srv/rokstones/public
chown -R rokstones:rokstones /srv/rokstones/public
test -f /srv/rokstones/.env || { echo "missing /srv/rokstones/.env (copy from .env.example)"; exit 1; }
install /tmp/rokstones.service /etc/systemd/system/rokstones.service
systemctl daemon-reload
systemctl enable --now rokstones
systemctl restart rokstones
sleep 1
systemctl --no-pager status rokstones | head -5
REMOTE
echo "done."
