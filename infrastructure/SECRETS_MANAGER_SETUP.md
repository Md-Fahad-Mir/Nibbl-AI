# AWS Secrets Manager Setup for Nibbl AI

This guide explains how to securely manage both the Grafana admin password and the shared OCR AI API key using AWS Secrets Manager, so neither lives in git or plaintext configuration.

## Overview

**Problem:** Deployment secrets must never be stored in git, even in private repos. Both the Grafana password and the credential shared by the backend and OCR AI service need a secure deployment path.

**Solution:** AWS Secrets Manager stores both values securely, and the EC2 instance (via an IAM role) fetches them at deploy time. The OCR key is written to the app stack's root-owned, mode-`0600` Compose `.env` file on EC2, then injected into the backend and AI containers; it is never committed or printed in CI logs.

**Architecture:**
```
Git (code only)
  ↓
Ansible playbook on EC2 (instance IAM role)
  ↓
AWS Secrets Manager
  ├── Grafana password → monitoring stack
  └── ai-api-key → /home/ubuntu/nibblai/.env (mode 0600)
                         ├── backend: RECEIPT_OCR_API_KEY
                         └── AI: API_KEY
```

## Prerequisites

- **AWS Account** with production environment configured
- **AWS CLI** installed and configured with credentials:
  ```bash
  aws configure
  # or export AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
  ```
- **Appropriate IAM permissions** to create secrets in Secrets Manager (handled by Terraform; see below)

## Initial Setup (One-Time)

### 1. Create the Grafana Secret in AWS Secrets Manager

The EC2 instance's IAM role (configured by Terraform in `infrastructure/terraform/shared/iam.tf`) grants permission to read the secret. You create the secret itself via the AWS CLI or console.

#### Option A: Using AWS CLI (Recommended)

```bash
# Set these variables (or update as needed)
REGION="us-west-1"
ENV="production"
PASSWORD="your-very-strong-random-password-here"

# Create the secret
aws secretsmanager create-secret \
  --name "nibblai/${ENV}/grafana-password" \
  --secret-string "${PASSWORD}" \
  --region "${REGION}" \
  --tags Key=Environment,Value=${ENV} Key=Project,Value=nibblai

# Expected output:
# {
#   "ARN": "arn:aws:secretsmanager:us-west-1:123456789:secret:nibblai/production/grafana-password-xxx",
#   "Name": "nibblai/production/grafana-password",
#   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# }
```

**Generate a strong password:**
```bash
# On macOS/Linux
openssl rand -base64 24

# Or Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Or just a strong passphrase
python3 -c "import secrets; words=['correct','horse','battery','staple']; print('-'.join([w + str(secrets.randbelow(100)) for w in words[:3]]))"
```

#### Option B: Using AWS Console

1. Open [AWS Secrets Manager](https://console.aws.amazon.com/secretsmanager)
2. Click **Store a new secret**
3. **Secret type:** Other type of secret
4. **Key/value:** Leave default (key: `GRAFANA_PASSWORD` or just paste the password as plain text)
5. **Secret name:** `nibblai/production/grafana-password`
6. **Tags:** 
   - `Environment: production`
   - `Project: nibblai`
7. Click **Next** → **Store secret**

### 2. Create the OCR AI API Key

The backend and AI container must receive the **same single-line value**: the
backend sends it as `X-API-Key`, and the AI validates it. Create one per
environment before the first application deployment:

```bash
REGION="us-west-1"
ENV="production"               # or staging
AI_API_KEY="$(openssl rand -hex 32)"

aws secretsmanager create-secret \
  --name "nibblai/${ENV}/ai-api-key" \
  --secret-string "${AI_API_KEY}" \
  --region "${REGION}" \
  --tags Key=Environment,Value=${ENV} Key=Project,Value=nibblai

unset AI_API_KEY
```

Use the exact name `nibblai/<environment>/ai-api-key`. The EC2 role's
least-privilege policy permits that name and the Grafana secret only.

### 3. Verify the Secret Can Be Retrieved

```bash
aws secretsmanager get-secret-value \
  --secret-id "nibblai/production/grafana-password" \
  --region us-west-1 \
  --query 'SecretString' \
  --output text
```

Should print your password. Repeat the command with
`nibblai/production/ai-api-key` to verify the OCR key. If it fails, check:
- Region is correct
- Secret name matches exactly
- Your AWS CLI credentials have `secretsmanager:GetSecretValue` permission

### 4. Verify the EC2 Role Has Permission

After running `terraform apply` (which adds the IAM policy), test from the EC2 instance:

```bash
ssh ubuntu@<your-ec2-instance-ip>

# On the instance:
aws secretsmanager get-secret-value \
  --secret-id "nibblai/production/grafana-password" \
  --region us-west-1 \
  --query 'SecretString' \
  --output text

# Should print the password. If you get "AccessDenied", Terraform didn't apply yet.
```

## Deploy Process

### During `make ansible-prod` or `make deploy-prod`

1. **Terraform** provisions/updates the EC2 role, including access to the two
   environment-scoped deployment secrets.
2. The **application deployment role** fetches
   `nibblai/<environment>/ai-api-key`, writes `/home/ubuntu/nibblai/.env` with
   mode `0600`, and starts Compose with that file.
3. Compose passes the exact same key to the backend as
   `RECEIPT_OCR_API_KEY` and to AI as `API_KEY`; the backend reaches AI at
   `http://ai:8001` on the private Docker network.
4. The monitoring role independently fetches the Grafana password for its
   monitoring stack.

The secrets never appear in git or deployment logs. The application OCR key is
persisted only in the root-owned runtime `.env` required by Docker Compose;
protect the EC2 host accordingly.

### Example Deploy Flow

```bash
# From your local machine
cd /path/to/nibbl-ai
export AWS_REGION=us-west-1
export REGISTRY=123456789.dkr.ecr.us-west-1.amazonaws.com
export IMAGE_TAG=abc123def456

# Option 1: Full bootstrap (Terraform + Ansible)
make deploy-prod

# Option 2: Just re-configure the server (Ansible only)
make ansible-prod
```

The application deployment role will:
1. Use the EC2 instance's IAM role (automatic via instance metadata)
2. Fetch `ai-api-key` from Secrets Manager
3. Write the root-owned application `.env` file safely
4. Restart the backend and AI Compose stack

## Rotating the Password

### When to Rotate

- Quarterly (security best practice)
- If the password is ever compromised
- If personnel with access leave
- Before major security events

### How to Rotate

**Option A: Update the existing secret (recommended)**

```bash
NEW_PASSWORD=$(openssl rand -base64 24)

aws secretsmanager update-secret \
  --secret-id "nibblai/production/grafana-password" \
  --secret-string "${NEW_PASSWORD}" \
  --region us-west-1

echo "New password: ${NEW_PASSWORD}"
# Save this in your password manager!
```

Then redeploy:
```bash
make ansible-prod
# or
make deploy-prod
```

**Option B: Manual Grafana UI update (if Secrets Manager is unavailable)**

1. SSH into the EC2 instance
2. Access Grafana locally: `ssh -L 3100:localhost:3100 ubuntu@<ip>`
3. Navigate to Grafana on `http://localhost:3100`
4. Log in with the old password
5. Admin menu → Preferences → Change password
6. Update the secret in Secrets Manager with the new password

### Verify Rotation

```bash
# Check the secret was updated
aws secretsmanager describe-secret \
  --secret-id "nibblai/production/grafana-password" \
  --region us-west-1

# Redeploy to use the new password
make ansible-prod

# SSH in and restart monitoring
ssh ubuntu@<ip>
cd /home/ubuntu/nibblai/deployment/monitoring
docker compose -f docker-compose.monitoring.yml restart grafana
```

## Troubleshooting

### "Secret not found" or "AccessDenied"

**On your local machine:**
```bash
# Verify you have AWS credentials configured
aws sts get-caller-identity

# Check the secret exists in the right region
aws secretsmanager list-secrets --region us-west-1 | grep grafana
```

**On the EC2 instance:**
```bash
# Check the instance has the IAM role attached
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Try to fetch the secret (should work if role is correct)
aws secretsmanager get-secret-value \
  --secret-id "nibblai/production/grafana-password" \
  --region us-west-1 \
  --query 'SecretString' \
  --output text
```

### Ansible playbook fails with "ignore_errors: true"

If the monitoring role's secret fetch fails, it falls back to the `grafana_password` env var (which is empty by default). This allows initial bootstrap without a secret, but Grafana will fail to start with an empty password.

**Fix:**
1. Ensure the secret exists: `aws secretsmanager list-secrets --region us-west-1 | grep grafana`
2. Ensure the EC2 instance has the IAM role: `aws ec2 describe-instances --instance-ids <id> | grep IamInstanceProfile`
3. Re-run: `make ansible-prod`

### Grafana container won't start

```bash
ssh ubuntu@<ip>
cd /home/ubuntu/nibblai/deployment/monitoring
docker compose -f docker-compose.monitoring.yml logs grafana | tail -50
```

If the log says "username or password is incorrect," the secret fetch failed or the password is empty.

## Security Best Practices

1. **Least Privilege:** The EC2 role's IAM policy allows reading only the Grafana and OCR AI secret ARNs for its own environment.
2. **Audit Trail:** All secret access is logged in CloudTrail. Check:
   ```bash
   # Via AWS CLI (if you have CloudTrail access)
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceName,AttributeValue=nibblai/production/grafana-password \
     --region us-west-1
   ```
3. **Encryption:** Secrets Manager encrypts passwords at rest using AWS KMS (no action needed; automatic).
4. **Rotation:** Use the `update-secret` flow above; never commit plaintext passwords to git.
5. **Access Control:** Only the EC2 instance (via its IAM role) can read this secret. No SSH keys or CI/CD tokens needed.

## Adding Other Secrets

This pattern works for any secret: API keys, database passwords, API tokens, etc.

**To add another secret:**

1. Create it in Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name "nibblai/production/my-secret" \
     --secret-string "value" \
     --region us-west-1
   ```

2. Grant the EC2 role access in `infrastructure/terraform/shared/iam.tf`:
   ```hcl
   {
     Sid      = "ReadMySecret"
     Effect   = "Allow"
     Action   = ["secretsmanager:GetSecretValue"]
     Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/my-secret-*"
   }
   ```

3. Fetch it in your Ansible role:
   ```yaml
   - name: Fetch my secret
     shell: |
       aws secretsmanager get-secret-value \
         --secret-id "nibblai/{{ env }}/my-secret" \
         --region "{{ aws_region }}" \
         --query 'SecretString' \
         --output text
     register: my_secret_result
     no_log: true
   ```

4. Use it:
   ```yaml
   - name: Write config with secret
     copy:
       content: "MY_SECRET={{ my_secret_result.stdout }}"
       dest: "{{ project_path }}/config/.env"
   ```

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Terraform aws_iam_role_policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy)
- [AWS CLI secretsmanager](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/index.html)
