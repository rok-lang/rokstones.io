# rokstones.io

Source for https://rokstones.io, the Rok package registry site and server. Rok packages are called stones. One program written in Rok: it reads a checkout of the registry index ([rokstones.io-index](https://github.com/rok-lang/rokstones.io-index)) and writes a static site to `public/`; `serve` serves that site plus GitHub login, publish tokens, trusted publishing from GitHub Actions, and the publish / yank API.

## Build

Needs the Rok toolchain (`rok`, `rokc`), `git`, an index checkout, and the [web kit](https://github.com/rok-lang/web) submodule at `web/` (clone with `git clone --recurse-submodules`, or run `git submodule update --init` in an existing clone). The default config assumes the repos sit side by side:

```
./
|-- rok/                 # toolchain (github.com/rok-lang/rok)
|-- rokstones.io-index/  # registry index
`-- rokstones.io/        # this repository
```

No toolchain? Install one (`curl -fsSL https://rok-lang.org/install.sh | sh`) or `cargo build --release` in `../rok`.

```bash
rok run                   # generate the site in public/ from the index in site.rokon
rok run -- check          # generate; exit 1 on broken links or bad index lines
rok run -- --demo         # generate from the sample index in fixtures/
rok run -- --offline      # don't fetch READMEs with git (cache only)
rok run -- --index <dir>  # use another index checkout
rok run -- --data <dir>   # show metadata, publishers and owners from the server's db.rokon
rok run -- serve          # serve public/ and the API (see Server)
rok test                  # unit tests
tests/e2e.sh              # end-to-end test of serve
```

`fixtures/` holds a sample index (`--demo`) with more stones and edge cases than the real one, a sample `db.rokon` (`fixtures/data`), plus READMEs and source trees for some of them, for checking the site without git or network. Each stone's latest commit is fetched into `.cache/git`: its README is rendered untrusted (HTML shown as text, non-http(s)/mailto links dropped), its tree is counted for the side panel (files, size, non-blank lines of `.rok`), and its public items become the API tab (`src/apidoc.rok`). Version dates are the commit dates of the index commits that added each version's line.

## Web kit

`web/` is [rok-lang/web](https://github.com/rok-lang/web), pinned to a commit. The site builds its `web` library in (`Dep::path("web/rok")`): HTTP, the canonical-address rules, the shared header and footer markup, and the kit's files, which every build writes into `public/` at `/rok.css`, `/theme.js`, `/keys.js`, `/copy.js`, `/rok.svg`, and the rokstones `/logo.svg`, `/favicon.ico` and `/apple-touch-icon.png`, plus the webfonts, copied from `web/assets/fonts` to `/fonts/` (served for a day with an ETag). The fonts are files, not built in, so the server's rebuilds need `web/assets/fonts` at run time; `og/render.mjs` reads `web/css/rok.css` and the mark through the templates. Move to a newer kit with:

```bash
git submodule update --remote web
rok run -- check && rok test
git commit -am "chore: bump the web kit"
```

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
| `ROKSTONES_DATA` | Directory of `db.rokon` (accounts, tokens, owners, each version's metadata and publisher), `readme/<name>/<version>.md` (READMEs sent with a publish) and `sources/` |
| `ROKSTONES_INDEX` | Index checkout the server commits to and pushes from |
| `ROKSTONES_TRUSTED` | Optional bootstrap file of trusted publishers (see Trusted publishing) |
| `ROKSTONES_AUDIENCE` | The `aud` an OIDC token must carry (default: the host of `ROKSTONES_URL`) |
| `GITHUB_OAUTH_URL`, `GITHUB_API_URL`, `GITHUB_OIDC_ISSUER` | Default GitHub; tests point them at a fake |

Login is GitHub OAuth only (`read:user`). Sessions are a 32-byte cookie stored as SHA-256. Publish tokens (`rks_` + 64 hex) are admin-only, stored as SHA-256 and compared in constant time. The ROKON API takes `Authorization: Bearer rks_..`:

| Route | Purpose |
|-------|---------|
| `GET /api/v1/me` | account + publish flag |
| `POST /api/v1/publish` | `Publish { entry: Stone { .. }, meta: { .. } }`: the index entry `rok publish` prints and the stone's metadata; answers `Published { name, version, file, warnings }`. A version already in the index from the same tree that was not published through the API (`rok publish --index-dir`) gets the metadata and README it lacks instead of a 409 |
| `POST /api/v1/yank` | `Yank { name, version, undo, native, message }`; `message` (at most 512 bytes) is the reason, cleared by an unyank |
| `GET /api/v1/stones/<name>` | no token: owners, and each `Version { version, yanked, yank_message, deps, meta, has_readme, downloads, published_by, yanked_by, unyanked_by }`; each actor is `Actor { id, login, at }`, plus `via` for trusted publishing; `deps` is as in the index line |
| `GET /api/v1/stones/<name>/<version>/readme` | no token: the README sent with that version, `text/markdown`; 404 when none was sent |
| `GET /api/v1/native/<name>` | the same for a native package (and `/<version>/readme`) |
| `POST /api/v1/trusted-publishing/token` | no token: `TrustedPublishing { jwt: ".." }` (or `{"jwt": ".."}`), a GitHub Actions OIDC token; answers `TrustedToken { token, expires, stones }` |
| `GET /api/v1/trusted-publishers` | the trusted publishers of the stones the account owns (admins: all) |
| `POST /api/v1/trusted-publishers` | `TrustedPublisher { stone, repository, workflow, environment }`; answers the record with its `id` and the owner's GitHub id |
| `POST /api/v1/trusted-publishers/remove` | `Remove { id }` |

An index line holds only what resolution needs, named as in the manifest: `name`, `version`, `deps`, `features`, `source`, `tree` (the commit's git tree hash), `yanked`, `toolchain`, `links`. A dependency is `{ name, req, kind, registry, optional, features, default_features, package, target }`: `package` is the stone it names when `name` is a rename (as Cargo's), `target` limits it to a triple or a `cfg(..)` expression, which the client evaluates.

Index lines stay strict: a field the server does not know is refused, because every reader of the index must understand every line it resolves. The server is deployed before the clients that write a new field, so it learns the field first; a field older clients would misread also takes a higher `v` on the line.

`meta` is forward compatible instead. The known keys are the manifest's descriptive fields (`description`, `license`, `license_file`, `authors`, `homepage`, `documentation`, `repository`, `readme`, `keywords`, `categories`, `include`, `exclude`, `publish`, `metadata`, `links`, `default_run`), what the client measured (`has_lib`, `bin_names`, `size`: packed bytes) and `readme_content` (the README text, at most 512 KiB). They are checked; any other key is kept as sent (at most 32 keys, 16 KiB), returned in the API with the rest, and named in the reply's `warnings`, never refused. The metadata is kept in `db.rokon` with the account and time of the publish, yank and unyank; the README text in its own file, shown on the stone page in place of the commit's README.

### Trusted publishing

A stone's owners (or the admins) name GitHub Actions workflows that may publish it: repository `owner/repo`, workflow file, and optionally an environment, on the account page or through the API. Adding one looks up the repository's owner id on GitHub, so a deleted and re-registered owner name does not match. A stone with no owner on record (not published yet, or from before this server) gets its first trusted publisher only from an admin or from `ROKSTONES_TRUSTED`: a ROKON list read at each start, replacing the publishers it gave before, which the account page shows but cannot remove:

```rokon
[
    TrustedPublisher { stone: "json", repository: "rok-lang/json", owner_id: 341800840, workflow: "publish.yml" },
]
```

The job sends its OIDC token to `POST /api/v1/trusted-publishing/token`. The server takes RS256 only, checks the signature against the issuer's JWKS (cached in `ROKSTONES_DATA/jwks.json`, fetched again for an unknown `kid` at most once a minute), `iss`, `aud`, `exp` / `nbf` / `iat` with 60 s of leeway, and refuses a `jti` it has seen. The claims match a publisher when `repository` and `repository_owner_id` are its own, `workflow_ref` is its workflow file at any ref (the calling workflow, not a reusable one it calls), and `environment` is its environment when it names one. The answer is an `rkt_` token, stored as SHA-256, that lasts 30 minutes and may publish and yank only the matched stones; `rok login` takes it (`/api/v1/me` says it may publish). Versions it publishes (and yanks it makes) record the user who triggered the run (`actor`, `actor_id`) as `published_by` with `via: Via { repository, workflow, ref, run_id, run_attempt }`, shown as "by <actor> via GitHub Actions" with links to the repository and the run; their index commits are authored by the repository. `pages/publish.yml` is the workflow for a stone's repository.

`downloads` stays 0: stones are fetched from their git source, not from this server, so nothing counts them yet. The field is there for when the server serves archives.

Each write runs under one lock: reset to upstream, append (or flip `yanked`), commit as the publishing account, and push; a failed push resets and answers 503. Entry and metadata validation, source fetch and tree-hash checks, and the commit flow are in `src/index.rok`.

An index from before 0.2 (`vers`, `cksum`, descriptive fields in the line) moves to these names once, by hand:

```bash
rok run -- migrate-index <index checkout> <data dir>   # rewrites the lines, keeps their metadata in db.rokon
git -C <index checkout> commit -am "Move index lines to the 0.2 field names"
```

Lines already in the new format are left alone, so a second run changes nothing.

Deploy as its own user with a git identity that can push to the index, behind a TLS proxy:

```caddy
rokstones.io {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

## Link previews

og:image and twitter:image carry `?v=<card version>`: the first 10 hex digits of the SHA-256 of what `og/render.mjs` draws the card from (renderer, template, fonts, the kit's mark and `rok.css`, the stone's name, version and description; for the home card also `static/og.png`), so a changed card is a new URL. The renderer writes `<card>.png.v` with the version it drew; `serve` caches a card at that `?v=` for a year (`immutable`), anything else for an hour, and a rebuild keeps only cards whose `.v` still matches. A stone page whose card is not drawn yet points at the site card (`/og.png?v=..`) instead, so after a build that changes cards run `node og/render.mjs` (it skips cards already drawn) and build again. `serve` does both itself after each rebuild when `og/node_modules` is installed (needs node and Chrome); otherwise new stones show the site card until a deploy draws theirs. When only a page's text changes, the cached card stays: re-scrape it with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) or Kakao's [sharing debugger](https://developers.kakao.com/tool/debugger/sharing) (clear the cache); X has no tool and refreshes in about 7 days.

## Configuration

Edit `site.rokon` (ROKON). Key fields: `title`, `tagline`, `description`, `index`, `index_repo`, `base_url`, `docs`, `home`, `cache`, `out`.

## Layout

| File | Contents |
|------|----------|
| `src/main.rok`   | Config/args, page generation, search index, link check; `serve` |
| `src/server.rok` | `serve`: settings, `db.rokon`, GitHub login, account page, API, rebuilds |
| `src/index.rok`  | API entry and metadata checks, index commits and pushes |
| `src/meta.rok`   | Per-version metadata and publisher records kept in `db.rokon` |
| `src/migrate.rok` | `migrate-index`: 0.1 index lines to the 0.2 names |
| `src/secret.rok` | SHA-256, random bytes, constant-time compare |
| `src/trust.rok`  | Trusted publishing: OIDC token (JWT) checks, JWKS keys, claim matching, exchanged tokens, the bootstrap file |
| `src/json.rok`   | The JSON GitHub answers with |
| `src/stones.rok` | Reads the index, semver ordering, dependents, version dates, README and source tree fetching |
| `src/apidoc.rok` | API tab: public items and `///` docs scanned from a stone's sources; the install box's `use` line |
| `src/layout.rok` | Page frame, home, stone list, publishing guide, stone pages and their tabs (Readme, API, Versions, Dependencies, Dependents) |
| `tests/`         | `e2e.sh` and the fake GitHub it runs (OAuth, `/user`, `/repos`, an OIDC issuer that signs test tokens) |
| `pages/publishing.md` | Publishing guide text |
| `pages/publish.yml` | The trusted publishing workflow for a stone's repository |
| `static/`        | `style.css`, `search.js`, `og.png` |
| `web/`           | the web kit (submodule): `rok.css`, `theme.js`, `keys.js`, marks and icons, and the `web` library (HTTP, addresses, header and footer markup) |
| `og/`            | Open Graph cards: `node og/render.mjs` after a build, then build again |

Markdown and highlighting come from the [`markdown`](https://github.com/rok-lang/markdown) and [`rok-syntax`](https://github.com/rok-lang/rok-syntax) stones (path dependencies until switched to their rokstones.io versions).
