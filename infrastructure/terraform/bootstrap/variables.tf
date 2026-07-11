# ─── Bootstrap Variables ──────────────────────────────────────────────

variable "project_name" {
  description = "Project name used for naming/tagging"
  type        = string
  default     = "nibblai"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-west-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name"
  type        = string
  default     = "default"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform remote state (e.g. nibblai-tfstate-<random>)"
  type        = string
}

variable "ecr_repositories" {
  description = "ECR repositories to create (one per service)"
  type        = list(string)
  # Add new service repositories here as those services are added to the monorepo.
  default = ["nibblai-backend"]
}
