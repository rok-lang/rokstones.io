# rokstones.io

The rok package registry site and server. rok packages are called **stones**. Both are one program written in rok. It reads a checkout of the registry index ([rokstones.io-index](https://github.com/rok-lang/rokstones.io-index)) and writes a static site to `public/`; `serve` serves that site plus GitHub login, publish tokens and the publish / yank API.

- Home page: what a stone is, search, recently published / most depended-on stones, usage, how to publish
- `stones/index.html`: all stones
- `stones/<name>.html`: version list (yanked marked), dependencies of the latest version (linked), dependents, source repository and commit, install instructions, README
- `search-index.json` + `search.js`: in-browser search

## Build

You need the rok toolchain (`rok`, `rokc`), `git`, and an index checkout. The default configuration assumes the repositories sit side by side.

```
./
├── rok/                   # toolchain (github.com/rok-lang/rok)
├── rokstones.io-index/    # registry index
├── stones/markdown/   # markdown renderer stone (path dependency)
├── stones/rok-syntax/     # rok / ROKON highlighter stone (path dependency)
└── rokstones.io/          # this repository
```

If you have no toolchain, install one (`curl -fsSL https://rok-lang.org/install.sh | sh`, see [Getting Started](https://docs.rok-lang.org/latest/learn/01-getting-started.html)) or build it from source:

```bash
cd ../rok
cargo build --release
export PATH="$PWD/target/release:$PATH"
```

Then, in this repository:

```bash
rok run                        # generate the site in public/ from the index in site.rokon
rok run -- check               # generate; exit code 1 on broken internal links or bad index lines
rok run -- --demo              # generate from the sample index in fixtures/
rok run -- check --demo        # generate from the samples + check
rok run -- --offline           # don't fetch READMEs with git (cache only)
rok run -- --index <dir>       # use another index checkout
rok run -- serve               # serve public/ and the API (see Server)
rok test                       # unit tests (index lines, HTTP, tokens, validation, .env)
tests/e2e.sh                   # end-to-end test of serve (see Tests)
```

When the build finishes it prints the number of stones, the number of stones with a README, the index error count, the broken link count, and the elapsed time. The link check verifies that the target file and `#anchor` of every `href` / `src` in the generated HTML exist.

## Sample index (`--demo`)

`fixtures/` holds a sample index for checking how the site looks without git or network access, with more stones and edge cases than the real index has.

| Path | Contents |
|------|----------|
| `fixtures/index/` | 8 stone files laid out like the index (`num`, `geom`, `json`, `http`, `url`, `rx`, `check`, `old`). Includes yanked versions, pre-releases, dev dependencies, a dependency on another index, and a stone whose versions are all yanked |
| `fixtures/readme/<name>.md` | READMEs used instead of git in `--demo` |

The sample stones' source URLs point to repositories that don't exist, so `--demo` never runs git.

## README

The README on a stone page comes from the `source` (git URL and commit) of the latest version. A single bare repository lives in `.cache/git`; `git fetch --depth 1 <url> <commit>` fetches just that commit, then `README.md` (or `readme.md`, `Readme.md`, `README`) is read and saved to `.cache/readme/<name>/<commit>.md`. The next build reuses the cache for the same commit. When offline or when fetching fails, the build only warns and renders the page without a README (failures are not cached, so the next build retries).

READMEs are written by anyone, so HTML blocks are shown as text rather than emitted, and links other than `http(s)` / `mailto` are dropped. For GitHub / GitLab / Codeberg repositories, relative links point to the file at that commit (raw for images).

## Preview

The search index is loaded with `fetch`, so open the site through a local server rather than `file://`.

```bash
python3 -m http.server -d public 8000
# http://localhost:8000
```

## Server

`rok run -- serve` (or `target/debug/rokstones_io serve`) serves `public/` and the routes below over plain HTTP on `ROKSTONES_ADDR`. TLS ends at a reverse proxy. Run it from this directory (it reads `site.rokon` and `.env`). At start, and after every index commit it makes, it rebuilds the site in the background by running itself with `--index $ROKSTONES_INDEX`; the new site is built in `public.new/` and swapped in.

### Settings (`.env`)

Copy `.env.example` to `.env` (git-ignored). Variables already set in the process environment win over the file.

| Variable | Meaning |
|----------|---------|
| `ROKSTONES_URL` | Public base URL (`https://rokstones.io`). The OAuth callback is `{ROKSTONES_URL}/auth/github/callback` |
| `ROKSTONES_ADDR` | Listen address (default `127.0.0.1:8080`) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub OAuth app |
| `ROKSTONES_ADMINS` | Comma-separated GitHub logins that may create publish tokens. Checked on every API call: removing a login takes its power away at once |
| `ROKSTONES_DATA` | Directory of `db.rokon` (accounts, sessions, tokens, owners), written atomically (temp file + rename), and `sources/` (a bare repository of fetched publish commits) |
| `ROKSTONES_INDEX` | Index checkout the server commits to and `git push`es from. It must track an upstream branch; push credentials are the server's own git configuration or SSH key |
| `GITHUB_OAUTH_URL`, `GITHUB_API_URL` | Default `https://github.com` / `https://api.github.com`; tests point them at a fake |

The GitHub OAuth app's callback URL is `{ROKSTONES_URL}/auth/github/callback`. Logging in asks only for `read:user`.

### Accounts and tokens

Logging in is only through GitHub OAuth (`/login`). An account is keyed by its numeric GitHub id. Sessions are a random 32-byte cookie (`HttpOnly; Secure; SameSite=Lax`, 30 days), stored as SHA-256.

`/me` shows the account. For logins in `ROKSTONES_ADMINS` it lists publish tokens (name, created, last used), creates one (shown once) and revokes them; for everyone else it says publishing is not open yet. A token is `rks_` and 64 hex digits (32 random bytes from the OS), stored only as its SHA-256 and compared in constant time. Forms carry a per-session CSRF token.

### API

Request and response bodies are ROKON. Requests carry `Authorization: Bearer rks_..`. Errors are `Error { message: ".." }` with a 4xx / 5xx status.

| Route | Body | Answer |
|-------|------|--------|
| `GET /api/v1/me` | | `Me { login: "..", publish: true }`; 401 for a bad token |
| `POST /api/v1/publish` | the index entry `rok publish` prints: a `Stone { .. }` line or a `Native { .. }` value | `Published { name: "..", vers: "..", file: ".." }` |
| `POST /api/v1/yank` | `Yank { name: "..", vers: "..", undo: false, native: false }` (`undo`, `native` optional) | `Yanked { name: "..", vers: "..", yanked: true }` |

Publishing and yanking need an admin token (403 "Publishing is not open yet" otherwise). An entry is checked as `rok publish` checks it: the name rule of spec 9.10.3 (`[a-z][a-z0-9_-]*`), no other spelling of the name in the index (`-` / `_` and case are one), a new version, dependencies on index packages only, `https://` source and artifact URLs, `yanked: false`, no unknown fields, valid `features`. The source commit of a stone is fetched (`git fetch --depth 1`) and must be a library package: `src/lib.rok` exists, else 400 "not a library package (no src/lib.rok)", and its tree hash must be the line's `cksum`, else 400 naming both; a commit that cannot be fetched is a 400 too. Native archives are not downloaded: their hashes, license files and target names are the client's checks. The first publisher of a name owns it (owners are kept in `db.rokon`); admins may publish any name.

Each write runs under one lock: the checkout is reset to its upstream, the line appended (or its `yanked` flipped), committed as `Publish <name> <vers>` / `Yank ..` / `Unyank ..` (author: the GitHub account) and pushed. When the push fails the checkout goes back to the upstream state and the answer is 503.

The index's root `config.rokon` (`Config { api: "https://rokstones.io" }`) tells the `rok` client where this API is.

### Deployment

Run the server as its own user, with a git identity that can push to the index and outbound HTTPS to fetch publish sources, behind a TLS proxy. Caddy:

```caddy
rokstones.io {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

Logs go to stderr, one line per request (method, path without query, status, time). They never contain tokens, cookies or OAuth codes.

## Tests

`rok test` runs the unit tests. `tests/e2e.sh` builds the program and `tests/fake-github` (a stand-in for GitHub's OAuth endpoints and `/user`), creates a temp index (a bare remote and a checkout), starts `serve` against both, then: logs in as an admin and as a non-admin through the callback, checks the state cookie and CSRF checks, creates a token, gets "not open yet" / 403 for the non-admin, calls `/api/v1/me`, publishes stones (sources are local git repositories mapped from `https://example.invalid/`) and a native package, rejects a source without `src/lib.rok`, one that cannot be fetched and a wrong `cksum`, yanks and unyanks, checks the commits pushed to the remote, a refused push (503, checkout reset), the rebuilt site, a login removed from the admins, revoking and logging out. It needs `rok`, `rokc`, `git` and `curl` on `PATH` and removes its temp directory at the end.

## Configuration

Edit `site.rokon` (ROKON).

| Field        | Meaning |
|--------------|---------|
| `title`      | Site name |
| `tagline`    | Home page subtitle |
| `index`      | Index checkout (default `../rokstones.io-index`) |
| `index_repo` | Web URL of the index repository (stone file links, pull request instructions) |
| `base_url`   | Site URL (`https://rokstones.io`), used for canonical links |
| `docs`       | Language docs URL (`https://docs.rok-lang.org`) |
| `cache`      | README cache directory (default `.cache`) |
| `out`        | Output directory (default `public`) |

## Layout

| File | Contents |
|------|----------|
| `src/main.rok`   | Reads configuration and arguments, generates pages, builds the search index, copies static files, checks links; `serve` |
| `src/server.rok` | `serve`: settings, `db.rokon`, GitHub login, account page, API, site rebuilds |
| `src/http.rok`   | HTTP/1.1 requests and responses, forms, cookies, static files |
| `src/index.rok`  | API entry checks (including the source's `src/lib.rok` and tree hash), index commits and pushes |
| `src/secret.rok` | SHA-256, random bytes, constant-time compare |
| `src/stones.rok` | Reads the index (`Stone { .. }` lines), semver ordering, latest version, dependents, source and README fetching |
| `src/layout.rok` | Page frame (header, search, footer), home page, stone list, stone page, markdown options |
| `tests/`         | `e2e.sh` and the fake GitHub it runs |
| `pages/index.md` | Home page text (what a stone is, using stones, publishing) |
| `static/`        | `style.css` (light / dark), `search.js`, logo |

Markdown rendering (`render_untrusted` for READMEs) and code highlighting are handled by the stones [`markdown`](https://github.com/rok-lang/markdown) and [`rok-syntax`](https://github.com/rok-lang/rok-syntax) (path dependencies in `rok.rokon`, on the checkouts under `../stones/`). They stay path dependencies until `rok.rokon` is switched to their rokstones.io versions.

Recent publish order and dates are read from the index's git history (the last commit that changed each stone file). If the index is not a git repository, stones are ordered by name.
