#!/bin/bash
# ─── install-frontend-nginx.sh ────────────────────────────────────────
# One-time (and on every change to deployment/nginx/production/frontends.conf):
# installs the web app vhosts on the production box via SSM, then gets TLS
# certificates with certbot. Run from your machine, repo root:
#   AWS_PROFILE=nibblai ./deployment/scripts/install-frontend-nginx.sh
# Requires the www / brand / admin DNS records to point at the box first
# ("DNS only" in Cloudflare, so Let's Encrypt can reach port 80).
set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="$SCRIPT_DIR/../nginx/production/frontends.conf"
DOMAINS="-d www.joinnibbl.com -d brand.joinnibbl.com -d admin.joinnibbl.com"

INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=nibblai-production" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
B64=$(base64 -w0 "$CONF")

# If the site file already exists (re-run), certbot's 443 blocks are kept by
# re-running certbot after the copy; --keep-until-expiring avoids a new cert.
SCRIPT="set -e
echo $B64 | base64 -d > /etc/nginx/sites-available/nibblai-frontends
ln -sf /etc/nginx/sites-available/nibblai-frontends /etc/nginx/sites-enabled/nibblai-frontends
nginx -t
systemctl reload nginx
certbot --nginx --non-interactive --keep-until-expiring --redirect $DOMAINS
nginx -t
systemctl reload nginx
certbot certificates 2>/dev/null | grep -E 'Name|Domains|Expiry'"
PARAMS=$(jq -n --arg s "$SCRIPT" '{commands: ($s | split("\n"))}')

CMD_ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --comment "Install web app nginx vhosts" \
  --parameters "$PARAMS" --query Command.CommandId --output text)
aws ssm wait command-executed --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" || true
aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
