# rokstones.io

Source for https://rokstones.io, the Rok package registry site and server. Rok packages are called stones. One program written in Rok: it reads a checkout of the registry index ([rokstones.io-index](https://github.com/rok-lang/rokstones.io-index)) and writes a static site to `public/`; `serve` serves that site plus GitHub login, publish tokens, and the publish / yank API.

## Build

Needs the Rok toolchain (`rok`, `rokc`), `git`, and an index checkout. The default config assumes the repos sit side by side:

```
./
|-- rok/                 # toolchain (github.com/rok-lang/rok)
|-- rokstones.io-index/  # registry index
|-- stones/markdown/     # markdown renderer stone (path dependency)
|-- stones/rok-syntax/   # rok / ROKON highlighter stone (path dependency)
`-- rokstones.io/        # this repository
```

No toolchain? Install one (`curl -fsSL https://rok-lang.org/install.sh | sh`) or `cargo build --release` in `../rok`.

```bash
rok run                   # generate the site in public/ from the index in site.rokon
rok run -- check          # generate; exit 1 on broken links or bad index lines
rok run -- --demo         # generate from the sample index in fixtures/
rok run -- --offline      # don't fetch READMEs with git (cache only)
rok run -- --index <dir>  # use another index checkout
rok run -- serve          # serve public/ and the API (see Server)
rok test                  # unit tests
tests/e2e.sh              # end-to-end test of serve
```

`fixtures/` holds a sample index (`--demo`) with more stones and edge cases than the real one, for checking the site without git or network. Stone-page READMEs are fetched by commit into `.cache/` and rendered untrusted (HTML shown as text, non-http(s)/mailto links dropped).

## Preview

Serve over HTTP (the search index is loaded with `fetch`). Links are root-relative and canonical: no `.html`, a directory index is the directory, no trailing slash (`/stones/json` is `stones/json.html`, `/stones` is `stones/index.html`). `rok run -- serve` resolves them and answers `.html`, `/index` and trailing-slash paths with a 301 to the canonical one; a plain file server only opens the pages themselves:

```bash
python3 -m http.server -d public 8000
```

## Server

`rok run -- serve` serves `public/` and the API over plain HTTP on `ROKSTONES_ADDR` (TLS ends at a reverse proxy). Run it from this directory (reads `site.rokon` and `.env`). At start and after each index commit it rebuilds the site in the background.

Settings live in `.env` (copy `.env.example`; process env wins over the file):

| Variable | Meaning |
|----------|---------|
| `ROKSTONES_URL` | Public base URL; OAuth callback is `{URL}/auth/github/callback` |
| `ROKSTONES_ADDR` | Listen address (default `127.0.0.1:8080`) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub OAuth app |
| `ROKSTONES_ADMINS` | Comma-separated GitHub logins that may create publish tokens |
| `ROKSTONES_DATA` | Directory of `db.rokon` (accounts, tokens, owners) and `sources/` |
| `ROKSTONES_INDEX` | Index checkout the server commits to and pushes from |
| `GITHUB_OAUTH_URL`, `GITHUB_API_URL` | Default GitHub; tests point them at a fake |

Login is GitHub OAuth only (`read:user`). Sessions are a 32-byte cookie stored as SHA-256. Publish tokens (`rks_` + 64 hex) are admin-only, stored as SHA-256 and compared in constant time. The ROKON API takes `Authorization: Bearer rks_..`:

| Route | Purpose |
|-------|---------|
| `GET /api/v1/me` | account + publish flag |
| `POST /api/v1/publish` | the index entry `rok publish` prints |
| `POST /api/v1/yank` | `Yank { name, vers, undo, native }` |

Each write runs under one lock: reset to upstream, append (or flip `yanked`), commit, and push; a failed push resets and answers 503. Entry validation, source fetch and tree-hash checks, and the commit flow are in `src/index.rok`.

Deploy as its own user with a git identity that can push to the index, behind a TLS proxy:

```caddy
rokstones.io {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

## Link previews

og:image and twitter:image carry `?v=<card version>`: the first 10 hex digits of the SHA-256 of what `og/render.mjs` draws the card from (renderer, template, fonts, logo, `rok.css`, the stone's name, version and description; for the home card also `static/og.png`), so a changed card is a new URL. The renderer writes `<card>.png.v` with the version it drew; `serve` caches a card at that `?v=` for a year (`immutable`), anything else for an hour, and a rebuild keeps only cards whose `.v` still matches. A stone page whose card is not drawn yet points at the site card (`/og.png?v=..`) instead, so after a build that changes cards run `node og/render.mjs` (it skips cards already drawn) and build again. `serve` does both itself after each rebuild when `og/node_modules` is installed (needs node and Chrome); otherwise new stones show the site card until a deploy draws theirs. When only a page's text changes, the cached card stays: re-scrape it with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) or Kakao's [sharing debugger](https://developers.kakao.com/tool/debugger/sharing) (clear the cache); X has no tool and refreshes in about 7 days.

## Configuration

Edit `site.rokon` (ROKON). Key fields: `title`, `tagline`, `description`, `index`, `index_repo`, `base_url`, `docs`, `home`, `cache`, `out`.

## Layout

| File | Contents |
|------|----------|
| `src/main.rok`   | Config/args, page generation, search index, link check; `serve` |
| `src/server.rok` | `serve`: settings, `db.rokon`, GitHub login, account page, API, rebuilds |
| `src/http.rok`   | HTTP/1.1 requests/responses, forms, cookies, static files |
| `src/index.rok`  | API entry checks, index commits and pushes |
| `src/secret.rok` | SHA-256, random bytes, constant-time compare |
| `src/stones.rok` | Reads the index, semver ordering, dependents, README fetching |
| `src/layout.rok` | Page frame, home, stone list, publishing guide, stone pages and their tabs |
| `tests/`         | `e2e.sh` and the fake GitHub it runs |
| `pages/publishing.md` | Publishing guide text |
| `static/`        | `rok.css` (copied from [rok-lang/web](https://github.com/rok-lang/web); do not edit here), `style.css`, `theme.js`, `search.js`, marks |
| `og/`            | Open Graph cards: `node og/render.mjs` after a build, then build again |

Markdown and highlighting come from the [`markdown`](https://github.com/rok-lang/markdown) and [`rok-syntax`](https://github.com/rok-lang/rok-syntax) stones (path dependencies until switched to their rokstones.io versions).
