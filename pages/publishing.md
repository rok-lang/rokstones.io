## What is a stone

A **stone** is a Rok package: one git repository with `rok.rokon` at its root and its sources in `src/`. The registry is nothing more than a single git repository, the [index](https://github.com/rok-lang/rokstones.io-index). Each version points to a commit in the stone's own repository, and `rok` fetches that commit and verifies it by tree hash. There is no server hosting source tarballs.

Using and publishing stones needs Rok 0.2 or later. The index is in the 0.2 format, which Rok 0.1 cannot read, and 0.1 is no longer supported: update with `rok toolchain update`.

## Using stones

Add a dependency with `rok add` in your project directory.

```sh
rok add json            # range compatible with the latest version (^0.2.0)
rok add http@^0.2       # explicit range
```

`rok add` writes one line to `deps` in `rok.rokon`. You can also write it by hand.

```rokon
Package {
    name: "app",
    version: "0.1.0",
    deps: {
        "json": Dep::version("^0.2.0"),
    },
}
```

The next `rok build` / `rok run` fetches the index, picks the highest version in range (excluding yanked ones), and pins it in `rok.lock`. In code, refer to it by the stone's name, as in `use json::Value;`.

Version requirements: `^1.2` (the default; a bare version means the same), `~1.2.3`, `=1.0.0`, `>=1.2, <2`, `1.*`, `*`.

## Publishing

Publishing adds one line to the index repository. Sources are not uploaded: the line names a commit of the stone's own repository.

The stone repository must have `rok.rokon` (`name`, `version`) at its root and its sources in `src/` (a library: `src/lib.rok`), a clean work tree, and its commit pushed to `origin`. Dependencies must be stones only (no `Dep::path` / `Dep::git`). Check what would be published with `rok publish --dry-run`.

With a rokstones.io account token, `rok login` keeps it and `rok publish` sends the line to the registry, which adds it to the index. A stone that has a trusted publisher is published from GitHub Actions instead (see [Trusted publishing](#trusted-publishing)). Publishing is not open to everyone yet: tokens and trusted publishers are for the registry's maintainers for now, and the index takes lines only from the registry.

A version published by mistake is not deleted but yanked: `rok yank <name>@0.3.1` (undo with `--undo`). Projects that already pinned it in `rok.lock` keep working.

The index line format is described in the [index README](https://github.com/rok-lang/rokstones.io-index#readme).

## Trusted publishing

A GitHub Actions workflow can publish a stone without any token stored in the repository. GitHub gives each job an OIDC token that says which repository, workflow and environment it runs for; rokstones.io checks GitHub's signature on it and, when the stone trusts that workflow, trades it for a publish token that lasts 30 minutes and works for that stone only. It is the same scheme as crates.io's, PyPI's and npm's trusted publishing.

Set it up once per stone:

1. On your [account page](/me), under **Trusted publishers**, add the stone, its GitHub repository (`owner/repo`), the workflow's file name (`publish.yml`) and, if the job runs in a GitHub environment, its name. Only the stone's owners can add one, and while publishing is not open yet only the registry's maintainers. A stone published before accounts existed has no owner on record; ask the registry's maintainers to add its first trusted publisher.
2. Add the workflow below to the repository as `.github/workflows/publish.yml`. It runs when a `v*` tag is pushed, checks that the tag matches `version` in `rok.rokon`, trades the job's OIDC token (audience `rokstones.io`) for a publish token, logs in with it and publishes.

```yaml
name: publish

on:
  push:
    tags: ['v*']
  # a tag pushed before this file was in the repository
  workflow_dispatch:
    inputs:
      tag:
        description: Tag to publish, e.g. v0.3.1
        required: true

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
        with:
          ref: ${{ inputs.tag || github.ref }}

      - name: Install rok
        run: |
          v=$(curl -fsSL https://github.com/rok-lang/rok/releases/latest/download/rok-version)
          curl -fsSL https://rok-lang.org/install.sh | ROK_NO_MODIFY_PATH=1 sh -s -- -q --version "$v"
          echo "$HOME/.rok/bin" >> "$GITHUB_PATH"

      - name: Check
        env:
          TAG: ${{ inputs.tag || github.ref_name }}
        run: |
          want=$(sed -n 's/^ *version: "\(.*\)",*$/\1/p' rok.rokon | head -1)
          [ "v$want" = "$TAG" ] || { echo "tag $TAG, but rok.rokon has version $want" >&2; exit 1; }
          rok test
          rok publish --dry-run

      - name: Log in with the job's OIDC token
        run: |
          jwt=$(curl -fsS -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=rokstones.io" | sed -n 's/.*"value":"\([^"]*\)".*/\1/p')
          out=$(curl -sS --fail-with-body -H 'Content-Type: application/rokon' \
            --data-binary "TrustedPublishing { jwt: \"$jwt\" }" \
            https://rokstones.io/api/v1/trusted-publishing/token) || { echo "$out" >&2; exit 1; }
          tok=$(printf '%s' "$out" | sed -n 's/.*token: "\(rkt_[0-9a-f]*\)".*/\1/p')
          [ -n "$tok" ]
          echo "::add-mask::$tok"
          printf '%s\n' "$tok" | rok login

      - name: Publish
        run: rok publish
```

Then release with `git tag v0.3.1 && git push origin v0.3.1`. For a tag pushed before the workflow was in the repository, run it by hand from the Actions tab (or `gh workflow run publish.yml -f tag=v0.3.1`): it runs the workflow from the default branch and publishes the tag's commit. Instead of `rok login`, the step can put the token in `ROK_REGISTRY_TOKEN` for the publish step (`echo "ROK_REGISTRY_TOKEN=$tok" >> "$GITHUB_ENV"`).

Any ref of the named workflow file may publish, so protect your `v*` tags (or use an environment with required reviewers) if others can push to the repository. The version page names the workflow that published it.

A version already in the index without its metadata (committed with `rok publish --index-dir`) gets it from the same command: `rok publish` of the same tree fills in the description, license, README and the rest, and changes nothing else.
