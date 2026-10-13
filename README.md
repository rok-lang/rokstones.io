# rokstones.io

The rok package registry site. rok packages are called **stones**. The site generator itself is written in rok. It reads a checkout of the registry index ([rokstones.io-index](https://github.com/rok-lang/rokstones.io-index)) and writes a static site to `public/`.

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
├── stones/rok-markdown/   # markdown renderer stone (path dependency)
├── stones/rok-syntax/     # rok / ROKON highlighter stone (path dependency)
└── rokstones.io/          # this repository
```

If you have no toolchain, build it first.

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
rok test                       # semver and index line tests
```

When the build finishes it prints the number of stones, the number of stones with a README, the index error count, the broken link count, and the elapsed time. The link check verifies that the target file and `#anchor` of every `href` / `src` in the generated HTML exist.

## Sample index (`--demo`)

The real index is still empty, so `fixtures/` holds samples for checking how the site looks.

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

## Configuration

Edit `site.rokon` (ROKON).

| Field        | Meaning |
|--------------|---------|
| `title`      | Site name |
| `tagline`    | Home page subtitle |
| `index`      | Index checkout (default `../rokstones.io-index`) |
| `index_repo` | Web URL of the index repository (stone file links, pull request instructions) |
| `base_url`   | Site URL (`https://rokstones.io`), used for canonical links |
| `docs`       | Language docs URL (`https://rok-lang.org`) |
| `cache`      | README cache directory (default `.cache`) |
| `out`        | Output directory (default `public`) |

## Layout

| File | Contents |
|------|----------|
| `main.rok`      | Reads configuration and arguments, generates pages, builds the search index, copies static files, checks links |
| `stones.rok`    | Reads the index (`Stone { .. }` lines), semver ordering, latest version, dependents, README fetching |
| `layout.rok`    | Page frame (header, search, footer), home page, stone list, stone page, markdown options |
| `pages/index.md`| Home page text (what a stone is, using stones, publishing) |
| `static/`       | `style.css` (light / dark), `search.js`, logo |

Markdown rendering (`render_untrusted` for READMEs) and code highlighting are handled by the stones [`rok-markdown`](https://github.com/rok-lang/rok-markdown) and [`rok-syntax`](https://github.com/rok-lang/rok-syntax) (path dependencies in `rok.rokon`). They become version dependencies once published to rokstones.io.

Recent publish order and dates are read from the index's git history (the last commit that changed each stone file). If the index is not a git repository, stones are ordered by name.
