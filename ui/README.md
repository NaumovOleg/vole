# Vole UI

React dashboard (login/register, API tokens, connections, request logs) served
from S3 + CloudFront.

## Prerequisites

- Bun (or npm) + Node 20+

## Dev

```bash
cd ui
bun install
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/dev npm run dev
```

Without `VITE_API_URL` the app calls relative `/api` paths (use a proxy or
serve behind the API domain).

## Build

```bash
npm run build
```

Output: `dist/` (static files uploadable to S3; CloudFront deployment is
covered in phase 10).