#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-VoleStack}"

output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue" \
    --output text
}

BUCKET=$(output UIBucketName)
DIST_ID=$(output UiDistributionId)

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ] || [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  echo "error: stack '$STACK_NAME' missing UIBucketName/UiDistributionId outputs — deploy it first: cd infra && cdk deploy" >&2
  exit 1
fi

npm --prefix ui run build
aws s3 sync ui/dist "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' > /dev/null

echo "UI deployed: https://vole.sh (wait for the invalidation to propagate)"