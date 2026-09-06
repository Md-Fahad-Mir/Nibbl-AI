#!/bin/bash
# ─── server-deploy.sh ─────────────────────────────────────────────────
# Runs ON the EC2 box (invoked by CI via SSM, or manually). Authenticates
# to ECR via the instance profile, pulls the requested image tag, restarts
# the stack, and runs migrations.
# Required env: REGISTRY, IMAGE_TAG. Optional: AI_IMAGE_TAG (defaults to IMAGE_TAG),
# AWS_REGION (default us-west-1).
set -euo pipefail

: "${REGISTRY:?REGISTRY env var required}"
: "${IMAGE_TAG:?IMAGE_TAG env var required}"
AI_IMAGE_TAG="${AI_IMAGE_TAG:-$IMAGE_TAG}"
AWS_REGION="${AWS_REGION:-us-west-1}"
export PATH="$PATH:/usr/local/bin"
PROJECT_ROOT="/home/ubuntu/nibblai"
export REGISTRY IMAGE_TAG AI_IMAGE_TAG PROJECT_ROOT

cd "$PROJECT_ROOT"

# Authenticate Docker to ECR using the EC2 instance profile (no static keys).
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

COMPOSE="docker compose --env-file .env \
  -f deployment/compose/docker-compose.base.yml \
  -f deployment/compose/production/docker-compose.yml"

# Reclaim disk from old layers before pulling new ones.
docker system prune -af --filter "until=24h" || true

# Pull the backend IMAGE_TAG and AI_IMAGE_TAG, then recreate containers. Migrations are
# applied by the backend container's entrypoint (RUN_MIGRATIONS=1) as a single
# process on startup — do NOT also migrate here, or a concurrent `exec migrate`
# races the entrypoint migrate on a fresh DB and corrupts migration state.
$COMPOSE pull
$COMPOSE up -d --force-recreate --remove-orphans

$COMPOSE ps
for attempt in $(seq 1 12); do
  if $COMPOSE exec -T ai curl --fail --silent http://localhost:8001/ready; then
    echo
    break
  fi
  if [ "$attempt" -eq 12 ]; then
    echo "AI service did not become ready on port 8001" >&2
    exit 1
  fi
  sleep 5
done
