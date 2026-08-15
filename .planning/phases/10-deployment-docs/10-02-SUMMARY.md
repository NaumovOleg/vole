# Plan Summary 10-02 — Root README

**Status:** Done
**Commit:** 4b6b4cd

## What was built

- `README.md` — what Vole is + traffic-flow diagram; component table; deploy
  in order: CDK (bootstrap, `ADMIN_IDENTIFIERS` env), Route 53 manual (ACM
  validation CNAMEs, then apex + wildcard A records → the two CloudFront
  outputs), `scripts/deploy-ui.sh`, CLI install from workspace; walkthrough
  register → token → tunnel → logs → admin block; dev commands; repo layout

## Deviations

- None.

## Follow-ups

- npm publishing of the `vole` CLI package (the README covers local install;
  `npm publish` is the remaining step when a registry is wanted).