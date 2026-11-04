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

With a rokstones.io account token, `rok login` keeps it and `rok publish` sends the line to the registry, which adds it to the index. Tokens are open to the registry's maintainers only for now. Without one, a stone is added by pull request: fork the index, let `rok publish --index-dir` commit the line in your checkout, push, and send it as a pull request to the [index repository](https://github.com/rok-lang/rokstones.io-index):

```sh
git clone https://github.com/<you>/rokstones.io-index
rok publish --index-dir rokstones.io-index
```

Once merged, the stone appears on this site.

A version published by mistake is not deleted but yanked: `rok yank <name>@0.3.1` (with `--index-dir <checkout>` for a pull request; undo with `--undo`). Projects that already pinned it in `rok.lock` keep working.

The index line format is described in the [index README](https://github.com/rok-lang/rokstones.io-index#readme).
