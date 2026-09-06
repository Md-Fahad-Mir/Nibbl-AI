#!/bin/bash
# ─── rollback.sh ──────────────────────────────────────────────────────
# Roll Nibbl AI production back to a previous backend image tag in ECR.
# Usage:  REGISTRY=<acct>.dkr.ecr.us-west-1.amazonaws.com \
#         EC2_HOST=<ec2-public-ip> ./rollback.sh <backend-git-sha> [ai-git-sha]
# For a revision from before the AI image existed, pass a known-compatible
# AI_IMAGE_TAG explicitly instead of silently pulling an unrelated image.
set -euo pipefail

BACKEND_TAG="${1:?Usage: ./rollback.sh <backend-git-sha> [ai-git-sha]}"
AI_IMAGE_TAG="${2:-${AI_IMAGE_TAG:-$BACKEND_TAG}}"
PROJECT_NAME="${PROJECT_NAME:-nibblai}"
REGISTRY="${REGISTRY:?REGISTRY env var required (your ECR registry URL)}"
EC2_HOST="${EC2_HOST:?EC2_HOST env var required}"
AWS_REGION="${AWS_REGION:-us-west-1}"

echo "▶ Rolling back Nibbl AI: backend=$BACKEND_TAG, ai=$AI_IMAGE_TAG"

ssh -i ~/.ssh/id_rsa "ubuntu@$EC2_HOST" << EOF
  set -euo pipefail
  cd /home/ubuntu/$PROJECT_NAME
  export PATH=\$PATH:/usr/local/bin
  export REGISTRY='$REGISTRY'
  export IMAGE_TAG='$BACKEND_TAG'
  export AI_IMAGE_TAG='$AI_IMAGE_TAG'
  export AWS_REGION='$AWS_REGION'

  # Authenticate to ECR via the instance profile, then verify both selected
  # tags exist before Compose changes a running service.
  aws ecr get-login-password --region "\$AWS_REGION" \
    | docker login --username AWS --password-stdin "\$REGISTRY"
  if ! aws ecr describe-images --repository-name nibblai-ai \
    --image-ids imageTag="\$AI_IMAGE_TAG" --region "\$AWS_REGION" >/dev/null 2>&1; then
    echo "AI image tag '\$AI_IMAGE_TAG' was not found. Re-run with a known-compatible AI_IMAGE_TAG." >&2
    exit 1
  fi

  COMPOSE="docker compose --env-file .env \
    -f deployment/compose/docker-compose.base.yml \
    -f deployment/compose/production/docker-compose.yml"

  \$COMPOSE pull
  \$COMPOSE up -d --force-recreate --remove-orphans

  echo "Nibbl AI rollback complete: backend=$BACKEND_TAG, ai=$AI_IMAGE_TAG."
  \$COMPOSE ps
EOF
