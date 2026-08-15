# Plan Summary 04-04 — CLI package + authtoken

**Status:** Done
**Commit:** a9bc135

## What was built

- `cli/package.json`: npm package `vole`, `bin: vole = dist/vole.js`, bun single-file build (`--target=node`, `--banner #!/usr/bin/env node`), `prepack` build, `type: module`
- `cli/tsconfig.json` (extends root base)
- `cli/src/config.ts`: `~/.vole/config.json` load/save (mode 0600)
- `cli/src/commands/authtoken.ts`: `vole authtoken <token> [server]` — saves token, warns on non-`vole_` prefix
- `cli/src/index.ts`: command dispatcher (authtoken / http / help)
- `cli/README.md`

## Deviations

- None.

## Follow-ups

- `vole http` was a stub — implemented in 04-05.
- Publishing `@tunell/shared` as a real npm package so `npm install -g vole` works for everyone (bundling makes it work locally); resolved by bundling at build time.
