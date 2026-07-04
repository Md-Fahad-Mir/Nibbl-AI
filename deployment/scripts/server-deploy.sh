#!/bin/bash
# ─── server-deploy.sh ─────────────────────────────────────────────────
# Runs ON the EC2 box (invoked by CI via SSM, or manually). Authenticates
# to ECR via the instance profile, pulls the requested image tag, restarts
# the stack, and runs migrations.
# Required env: REGISTRY, IMAGE_TAG.  Optional: AWS_REGION (default us-west-1).
set -euo pipefail

: "${REGISTRY:?REGISTRY env var required}"
: "${IMAGE_TAG:?IMAGE_TAG env var required}"
AWS_REGION="${AWS_REGION:-us-west-1}"
export PATH="$PATH:/usr/local/bin"
PROJECT_ROOT="/home/ubuntu/nibblai"
export REGISTRY IMAGE_TAG PROJECT_ROOT

cd "$PROJECT_ROOT"

# Authenticate Docker to ECR using the EC2 instance profile (no static keys).
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

COMPOSE="docker compose \
  -f deployment/compose/docker-compose.base.yml \
  -f deployment/compose/production/docker-compose.yml"

# Reclaim disk from old layers before pulling new ones.
docker system prune -af --filter "until=24h" || true

# Pull the images for this exact tag and recreate containers. Migrations are
# applied by the backend container's entrypoint (RUN_MIGRATIONS=1) as a single
# process on startup — do NOT also migrate here, or a concurrent `exec migrate`
# races the entrypoint migrate on a fresh DB and corrupts migration state.
$COMPOSE pull
$COMPOSE up -d --force-recreate --remove-orphans

$COMPOSE ps
