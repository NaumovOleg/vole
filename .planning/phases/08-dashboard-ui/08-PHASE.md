# Phase 8: Dashboard UI

## Goal

User manages tunnels and inspects traffic from the browser.

## Requirements

DASH-01, DASH-02, DASH-03, DASH-04, DASH-05.

## Success Criteria

1. React app loads via HTTPS from S3+CloudFront (infra exists since phase 1)
2. User registers/logs in, sees tokens, creates and revokes them
3. Connections table shows active tunnels with subdomain and status
4. Logs table shows recent requests (method, path, status, latency)

## Design

- **Stack:** React 18 + TypeScript + Vite in `ui/` (monorepo). No router — a
  `loggedIn` state switch between the auth screen and the dashboard (two screens
  is not worth a router). No UI kit — plain CSS.
- **API:** `ui/src/api.ts` — thin fetch wrapper; base URL from `VITE_API_URL`
  (build env) with relative fallback; `Authorization: Bearer <jwt>` from
  localStorage; JSON errors surfaced to UI.
- **Backend already done (phase 2+7):** `/auth/register`, `/auth/login`,
  `/auth/me`, `/tokens` CRUD, `/connections`, `/logs`; CORS `allowOrigins ['*']`
  on the HttpApi.
- **Screens:**
  - Auth screen: toggle login/register (email or phone + password)
  - Dashboard: tokens panel (create + one-time copy + revoke), connections
    table (subdomain, type, local port, active), logs table (method, path,
    status, latency, time), manual refresh + 10s auto-refresh on dashboard tab
  - Logout clears localStorage → auth screen
- **Deploy:** S3 upload + CloudFront invalidation is phase 10 (INFRA-04/05) — UI
  ships with `npm run build` here.

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 08-01 scaffold + auth screens | Foundation |
| 2 | 08-02 dashboard (tokens/connections/logs) | Depends on 08-01 |
| 3 | 08-03 refresh UX + polish | Depends on 08-02 |

## Acceptance

1. Register → login → dashboard round-trip works against the live API
2. Token create shows raw token once (copy button); revoke removes it
3. Connections and logs tables render live data; 401 → back to auth screen
4. `cd ui && npx tsc --noEmit && npm run build` green