# Plan Summary 08-01 — Scaffold + auth screens

**Status:** Done
**Commit:** 77d5dce

## What was built

- `ui/` Vite + React 18 + TS: package.json, tsconfig, vite.config, index.html, .gitignore
- `ui/src/api.ts` — fetch wrapper (VITE_API_URL + relative fallback, Bearer JWT from
  localStorage, readable errors from {error} body)
- `ui/src/App.tsx` — jwt→me() bootstrap, auth/dashboard switch, loading state
- `ui/src/AuthScreen.tsx` — login/register toggle, validation, inline errors
- `ui/src/styles.css` — plain dark theme, no component library

## Deviations

- None.

## Follow-ups

- Dashboard implemented in 08-02.