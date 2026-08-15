# Phase 10: Deployment & Docs

## Goal

Anyone can deploy and operate the service.

## Requirements

INFRA-04, INFRA-05.

## Success Criteria

1. One command builds + deploys UI to S3 and invalidates CloudFront
2. README documents `cdk deploy`, manual Route 53 setup, `npm install -g vole`
3. End-to-end walkthrough works: register → token → tunnel → request → logs visible

## Design

- **Deploy script (INFRA-04):** `scripts/deploy-ui.sh` — one command:
  `npm run build` in `ui/`, read UI bucket + distribution id from the CDK stack
  outputs (`aws cloudformation describe-stacks`), `aws s3 sync --delete`,
  `aws cloudfront create-invalidation --paths '/*'`.
  Requires AWS CLI + creds + deployed stack; no extra tooling.
- **CDK:** add `UiDistributionId` CfnOutput next to the existing bucket name
  output (script discovers it).
- **README (INFRA-05):** root `README.md` — what Vole is, architecture sketch,
  prerequisites (Node 22+, Bun, AWS CLI, CDK), deploy order:
  1. `cd infra && cdk bootstrap && cdk deploy` (sets `ADMIN_IDENTIFIERS` env to
     pick the admin, e.g. `ADMIN_IDENTIFIERS=me@example.com`)
  2. Route 53 manual: DNS validation CNAMEs from ACM (vole.sh + *.vole.sh),
     then A/alias records → the two CloudFront domains (apex UI + wildcard
     tunnels)
  3. UI deploy: `scripts/deploy-ui.sh`
  4. CLI: `npm install -g vole` (placeholder — published package is future
     work; today `bun build` from `cli/`), then `vole http 3000` etc.
- **Docs checked in:** README.md + infra/README? No — single root README,
  CLI README already exists. Walkthrough covers register → token → tunnel →
  request → logs (the full v1 story, including admin block).

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 10-01 deploy script + CDK output | Script depends on the output |
| 2 | 10-02 root README | Documents everything incl. 10-01 |

## Acceptance

1. `scripts/deploy-ui.sh` runs end to end when creds + stack exist
2. README steps reproduce a full deploy by an outsider
3. All 36 requirements traceable to code/docs; `bun test`, `tsc`, `cdk synth` green