# Release packages

A GitHub Release is a versioned download location for ordinary package artifacts.
Bun installs a `.tgz` URL into `node_modules` and records the dependency in
`package.json` and `bun.lock`; imports still use `@companion-kit/core` and the
selected `@companion-kit/character-*` names. Python hosts use `uv add <wheel URL>`.
No npm/PyPI registry publication is required.

## Verify and prepare

Use Bun for JavaScript dependencies and builds, and uv for the optional Python
package. Checked-in artwork means no image-generation service is needed.

```sh
bun install --frozen-lockfile
bun run check
bun run build
bun run demo:build
bun run test:package
# Requires Chromium; optionally set PLAYWRIGHT_BROWSERS_PATH.
bun run test:browser
uv run --project server pytest server/tests
```

Package versions live in the root and character `package.json` files, and in
`server/pyproject.toml`. The pack generator preserves those versions. Increment
versions for changed packages and update the README's pinned installation URLs.
Core's version determines the release tag; other packages have independent versions.

Commit source/generated changes after verification, then:

```sh
bun run release:prepare
```

This requires a clean checkout, rebuilds core, creates fresh tarballs and builds
the wheel. It selects exact versioned filenames, never a glob of old test output.
`release/` contains:

- Core and four independently installable character `.tgz` files.
- The optional `companion_harness-<version>-py3-none-any.whl`.
- `manifest.json`: versions, download URLs, source commit, byte sizes and SHA-256.
- `SHA256SUMS`: package and manifest checksums.
- `RELEASE_NOTES.md`: the GitHub release body; not an installable asset.

Run `sha256sum --check SHA256SUMS` inside `release/` to verify the artifacts.
The package test must run against current versions in a fresh consumer; do not
reuse an earlier tarball or replace installation with a source alias.

## Publish

Publishing is an explicit maintainer action; preparation never uploads anything.
For example, for `v0.6.1`, after reviewing the prepared artifacts:

```sh
git tag -a v0.6.1 -m 'Companion v0.6.1'
git push origin main v0.6.1
gh release create v0.6.1 --verify-tag --draft \
  --title 'Companion v0.6.1' --notes-file release/RELEASE_NOTES.md \
  release/*.tgz release/*.whl release/manifest.json release/SHA256SUMS
gh release edit v0.6.1 --draft=false --latest
```

Install the published URLs in a clean external project and verify imports and
asset loading. Release assets must remain immutable: publish a new package
version/release instead of replacing bytes at a URL already used by lockfiles.
GitHub's automatic “Source code” archives are not these built packages.
