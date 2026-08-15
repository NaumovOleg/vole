# Plan Summary 10-01 — One-command UI deploy

**Status:** Done
**Commit:** d40e317

## What was built

- `infra/lib/vole-stack.ts` — `UiDistributionId` CfnOutput (next to the
  existing UIBucketName/UiDistributionDomain)
- `scripts/deploy-ui.sh` — one command: reads bucket + distribution id from the
  stack outputs, `npm run build` in `ui/`, `aws s3 sync --delete`, CloudFront
  invalidation `/*`; clear error if the stack isn't deployed (`BUCKET` empty)

## Deviations

- None.

## Follow-ups

- 10-02 documents the script in the root README.