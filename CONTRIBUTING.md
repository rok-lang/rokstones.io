# Contributing

This repository is a website built with rok. The generator reads a checkout of
the registry index and checks every internal link; see the README for the
full build.

## Development

```sh
rok run           # build the site into its output directory
rok fmt --check
```

## Submitting

Open a pull request against `main` with the site building and `rok fmt --check`
passing.
