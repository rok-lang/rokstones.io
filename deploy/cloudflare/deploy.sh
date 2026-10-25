#!/bin/sh
# Build the registry site and publish it to Cloudflare Pages. Needs
# wrangler and CLOUDFLARE_API_TOKEN, the rok toolchain, and the index
# checkout the generator reads (site.rokon `index`, or --index).
#
#   deploy/cloudflare/deploy.sh [-- <rok run args>]
#
# The dynamic routes (/me, /auth, publishing) live on the API backend;
# point those at it (a Cloudflare rule, or a separate host api.rokstones.io).
set -eu
here=$(cd "$(dirname "$0")/../.." && pwd)
cd "$here"
# Drop the optional `--` separator; guard the shift because dash treats a
# shift past $# as a fatal special-builtin error (bypassing `|| true`).
[ $# -gt 0 ] && shift || true
rok run "$@"
wrangler pages deploy public --project-name rokstones-io --branch main
echo "deployed rokstones.io (static). The API is on the backend (deploy/terraform)."
