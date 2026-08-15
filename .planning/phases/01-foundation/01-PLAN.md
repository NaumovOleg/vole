---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.base.json
  - .gitignore
  - README.md
  - infra/package.json
  - infra/cdk.json
  - infra/tsconfig.json
  - infra/bin/tunell-app.ts
  - infra/lib/tunell-stack.ts
  - infra/lib/lambdas/ws-handler/index.ts
  - infra/lib/lambdas/relay-handler/index.ts
  - infra/lib/lambdas/auth-handler/index.ts
  - shared/package.json
  - shared/tsconfig.json
  - cli/package.json
  - ui/package.json
autonomous: true
user_setup:
  - service: aws
    why: "Deploy CDK stack to user's AWS account"
    env_vars:
      - name: AWS_CREDENTIALS
        source: "aws configure or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars"
    dashboard_config:
      - task: "Run `cdk bootstrap aws://ACCOUNT/REGION` once (Claude runs it after creds present)"
      - task: "Add ACM validation CNAME records for tunell.com + *.tunell.com in Route 53 (manual DNS, owner does it)"
must_haves:
  truths:
    - "cdk synth produces a template containing all planned resources: 5 DynamoDB tables, WS API with 3 routes, relay Lambda + Function URL, HTTP API, 2 CloudFront distributions (UI + wildcard), ACM cert, UI S3 bucket"
    - "Tables have PAY_PER_REQUEST billing; connections and logs have TTL"
    - "cdk deploy succeeds on an AWS account (AWS_CREDENTIALS + bootstrap present)"
    - "Repo has monorepo layout with npm workspaces: infra/, cli/, ui/, shared/ and a root build script"
  artifacts:
    - infra/lib/tunell-stack.ts (all resources defined)
    - infra/lib/lambdas/{ws,relay,auth}-handler/index.ts (stub handlers)
    - package.json (workspaces), tsconfig.base.json, .gitignore, README.md
  key_links:
    - "WS API routes wired to ws-handler Lambda integration"
    - "relay-handler Function URL wired as CloudFront wildcard distribution origin"
    - "UI bucket wired as apex distribution origin"
---

<objective>
Scaffold the Tunell monorepo and define the COMPLETE infrastructure structure in a single CDK stack with stub Lambda handlers. The stack synthesizes and deploys; real handler logic arrives in later phases.

Purpose: Locks the architecture in deployable code before feature work — every resource exists, wired, and synthable.
Output: npm-workspaces monorepo (infra/, cli/, ui/, shared/) + TunellStack with full structure + stub Lambdas + README.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Monorepo scaffold</name>
  <files>package.json, tsconfig.base.json, .gitignore, README.md, shared/package.json, shared/tsconfig.json, cli/package.json, ui/package.json</files>
  <action>Create npm-workspaces monorepo. Root package.json: "name": "tunell", "private": true, workspaces ["infra", "cli", "ui", "shared"], scripts: "build": "npm run build -w shared && npm run build -w infra", "lint" placeholder. tsconfig.base.json: strict, target ES2022, module NodeNext, moduleResolution NodeNext, sourceMap. .gitignore: node_modules/, cdk.out/, dist/, .env, *.tsbuildinfo. shared/: package.json ("name": "@tunell/shared", main src/index.ts) + tsconfig extending base, src/index.ts exporting a PROTOCOL_VERSION const. cli/ and ui/: package.json only ("name": "@tunell/cli"/"@tunell/ui", private, version 0.0.0) — no implementation yet. README.md: project description, monorepo layout table, dev workflow (npm install at root, npm run build, cdk deploy from infra/), note that Route 53 DNS for tunell.com is manual. Do NOT add comments to generated code.</action>
  <verify>node -e "require('./package.json').workspaces" && ls cli ui shared infra && npm install succeeds at root</verify>
  <done>Monorepo with 4 workspaces installs cleanly; README documents layout and dev workflow</done>
</task>

<task type="auto">
  <name>Task 2: Full CDK stack structure</name>
  <files>infra/package.json, infra/cdk.json, infra/tsconfig.json, infra/bin/tunell-app.ts, infra/lib/tunell-stack.ts, infra/lib/lambdas/ws-handler/index.ts, infra/lib/lambdas/relay-handler/index.ts, infra/lib/lambdas/auth-handler/index.ts</files>
  <action>Create CDK app "Tunell" in infra/. package.json: aws-cdk-lib, constructs, @types/aws-cdk-lib, aws-cdk, typescript, @types/node; scripts: "synth": "cdk synth", "deploy": "cdk deploy". cdk.json: app "npx ts-node --prefer-ts-exts bin/tunell-app.ts". bin/tunell-app.ts: new App, new TunellStack(app, 'TunellStack', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } }).

lib/tunell-stack.ts — define ALL of the following (stub handler code separate, keep stack wiring clean):
1. DynamoDB tables (aws-dynamodb, PAY_PER_REQUEST, all STRING keys, onDemand): UsersTable (pk 'userId'), TokensTable (pk 'tokenId', GSI 'tokenHashIndex' on 'tokenHash'), ConnectionsTable (pk 'connectionId', TTL on 'expiresAt'), TunnelsTable (pk 'subdomain'), LogsTable (pk 'connectionId', sk 'requestId', TTL on 'expiresAt').
2. Lambda functions (aws-lambda, NodejsFunction via aws-lambda-nodejs? NO — plain lambda.Function with code from ./lib/lambdas/<name>/index.ts, runtime NODEJS_20_X, handler index.handler, basic execution role, environment: TABLE_* env vars pointing to table names, ConnectionsTable granted read/write):
   - ws-handler: stubbed, returns { statusCode: 200, body: 'ok' }; wired to all 3 WS routes
   - relay-handler: stubbed; gets Function URL (aws-lambda FunctionUrl, authType NONE, CORS *, invokeMode RESPONSE_STREAM) — final auth wiring in phase 4
   - auth-handler: stubbed (auth logic in phase 2)
3. WebSocket API (aws-apigatewayv2 WebSocketApi + WebSocketLambdaIntegration from aws-apigatewayv2-integrations): connectRouteOptions, disconnectRouteOptions, defaultRouteOptions all → ws-handler. WebSocketStage 'dev', autoDeploy true. Grant ws-handler manageConnections on the API (api.grantManageConnections(wsHandler)).
4. HTTP API (aws-apigatewayv2 HttpApi, corsAllowOrigins ['*'], createDefaultStage false, stage 'dev' autoDeploy) — routes added in phase 2. Export its URL.
5. UI: S3 bucket (aws-s3, blockPublicAccess all blocked, website not enabled — served via CloudFront). 
6. ACM certificate (aws-certificatemanager, us-east-1 region scope: Certificate.fromCertificateArn? NO — create Certificate with domains ['tunell.com', '*.tunell.com'], validation: fromDns()) — note: DNS validation records pending (user adds manually in Route 53).
7. CloudFront (aws-cloudfront): 
   - UI distribution: aliases ['tunell.com'], default behavior → S3 origin with OAC (originAccessControl), viewerCertificate acm cert, priceClass 100, errorResponses 403→200 index.html (SPA), comment 'Tunell UI'
   - Tunnel distribution: aliases ['*.tunell.com'], default behavior → relay-handler Function URL origin (customOrigin httpsOrigin on the FunctionUrl url, originPath none), viewerCertificate same cert, priceClass 100, comment 'Tunell tunnels'
8. Outputs (aws-cdk-lib CfnOutput): WebSocketUrl, HttpApiUrl, RelayUrl, UIBucketName, UI distribution domain, Tunnel distribution domain.

Stub Lambda source files: each exports `export async function handler(event: any): Promise<any>` returning `{ statusCode: 200, body: JSON.stringify({ ok: true }) }`. ws-handler/relay-handler/auth-handler each in own dir.

Do NOT add comments. Use exact imports from aws-cdk-lib. Ensure cdk synth passes (no missing required props, e.g. CloudFront requires origin s3Origin with originAccessIdentity OR OAC, HttpApi needs at least default stage or route; add placeholder route `GET /health` to HttpApi wired to auth-handler stub so it synthesizes).</action>
  <verify>npm install in infra/ then `npx cdk synth` in infra/ exits 0 and template includes: 5 DynamoDB tables (2 with TimeToLiveSpecification), WebSocketApi with 3 routes, 2 Lambda functions with Function URL, HttpApi, 2 CloudFront distributions, S3 bucket, ACM cert</verify>
  <done>cdk synth succeeds; template contains all 8 resource groups; outputs defined</done>
</task>

<task type="auto">
  <name>Task 3: Bootstrap, deploy and verify structure</name>
  <files>infra/lib/tunell-stack.ts (only if deploy reveals issues)</files>
  <action>If AWS credentials are not configured in the environment (check AWS_ACCESS_KEY_ID or ~/.aws/credentials), STOP this task and report: stack is synth-ready, deploy requires user credentials (see user_setup). If credentials exist: run `npx cdk bootstrap` (idempotent, safe if already bootstrapped), then `npx cdk deploy --require-approval never`. Record outputs: WebSocket URL, API URLs, distribution domain names. Verify deployed resources: `aws dynamodb list-tables` shows the 5 tables; `aws apigatewayv2 get-apis` shows WebSocket API; `aws cloudfront list-distributions` shows 2 distributions. Do NOT verify CloudFront behavior routing (phase 4).</action>
  <verify>aws dynamodb list-tables | grep -E "users|tokens|connections|tunnels|logs" && cdk deploy exits 0</verify>
  <done>Stack deployed; 5 tables + WS API + 2 distributions exist in the account; outputs captured in 01-foundation-01-SUMMARY.md</done>
</task>

</tasks>

<verification>
Run `cdk synth` from infra/ — must pass. If deployed: table list matches expected names, WS API exists.
</verification>

<success_criteria>
- npm workspaces install cleanly at root
- cdk synth produces complete template (all 8 resource groups)
- cdk deploy succeeds (if credentials present) — otherwise deploy is blocked on user AWS credentials only
- README documents layout and manual Route 53 step
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-01-SUMMARY.md`
</output>
