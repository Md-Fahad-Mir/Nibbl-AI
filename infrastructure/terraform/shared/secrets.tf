# ─── Secrets Manager ──────────────────────────────────────────────
# Stores sensitive credentials (Grafana and AI API keys) per environment.
#
# To initially create/update the secret, use the AWS CLI:
#   aws secretsmanager create-secret \
#     --name "nibblai/production/grafana-password" \
#     --secret-string "your-strong-password-here" \
#     --region us-west-1 \
#     --tags Key=Environment,Value=production Key=Project,Value=nibblai
#
# Or rotate via:
#   aws secretsmanager update-secret \
#     --secret-id "nibblai/production/grafana-password" \
#     --secret-string "new-password" \
#     --region us-west-1

# The secret is created and managed outside Terraform (via AWS CLI or console)
# to avoid storing passwords in tfstate files. Terraform only grants the
# EC2 role permission to read it (see iam.tf).
#
# To check the current secret:
#   aws secretsmanager get-secret-value \
#     --secret-id "nibblai/production/grafana-password" \
#     --region us-west-1

# Optional: use this data source to reference the secret in Terraform
# if you need to pass it to other resources. By default, this is commented
# out because we want to keep the secret opaque — only the Ansible playbook
# fetches it at deploy time.
#
# data "aws_secretsmanager_secret" "grafana_password" {
#   name = "${var.project_name}/${var.environment}/grafana-password"
# }
#
# data "aws_secretsmanager_secret_version" "grafana_password" {
#   secret_id = data.aws_secretsmanager_secret.grafana_password.id
# }
