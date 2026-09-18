# Working on Companion

Use Bun for installs, lockfiles, scripts, tests and packing. Keep `bun.lock`; do
not introduce npm lockfiles.

This is an independent package. EvalHub, its controller and other applications
are consumers. Do not add imports, assets, paths or runtime configuration that
depend on an EvalHub checkout.

- Core: `src/controller.ts`, `src/character.ts`, `src/agent.ts`. No DOM or framework
  imports. Keep SSR imports safe.
- View: `src/element.ts`. Browser custom element, Shadow DOM and Canvas. No
  React/Vue dependencies here. Own and release animation/listener lifecycles.
- Adapters: `src/adapters/`. Thin framework integration only, optional peers.
- Artwork: `artwork/` generators, `characters/` manifests and committed outputs.
  Update generator and outputs together. Reactions are data, not a core enum.
- Public API: `src/index.ts` and package export entries. Avoid implicit network
  connections; host code supplies the agent adapter.
- Examples consume public built exports. `test:package` must continue installing
  an actual tarball into another directory; do not replace it with source aliases.

Verify code with `bun run check && bun run build && bun run demo:build`, then
`bun run test:package` and `bun run test:browser` for integration changes.
The browser command needs Playwright Chromium; `PLAYWRIGHT_BROWSERS_PATH` can
point to an existing installation. Do not publish or push unless requested.

Write focused regression tests for playback, pack validation, stale asynchronous
results and resource teardown. Keep character art-review assets out of the
runtime bundle unless they are actually referenced by a manifest.
