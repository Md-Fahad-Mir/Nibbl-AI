# ─── Nibbl AI Main Terraform Configuration ───────────────────────────
# Composes all modules together. Use from environments/<env>/ directory.

# AWS Key Pair
resource "aws_key_pair" "deploy_key" {
  key_name   = "${var.project_name}-${var.environment}-key"
  public_key = file(pathexpand(var.public_key_path))
}

# EC2 Instance
resource "aws_instance" "app_server" {
  # Use an explicit AMI if provided, otherwise the latest Ubuntu 24.04 lookup.
  ami                    = var.ami != "" ? var.ami : data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.deploy_key.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  # 30 GB encrypted gp3 root volume — 8 GB default is too small for 4
  # Docker images + build cache.
  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Elastic IP
resource "aws_eip" "static_ip" {
  instance = aws_instance.app_server.id

  tags = {
    Name        = "${var.project_name}-${var.environment}-eip"
    Environment = var.environment
  }
}

# S3 Bucket
resource "aws_s3_bucket" "media" {
  bucket = var.bucket_name

  tags = {
    Name        = "${var.project_name}-media"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://api.${var.domain}", "http://localhost:8000"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "media" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_public_access_block.media]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource = [
          "${aws_s3_bucket.media.arn}/static/*",
          "${aws_s3_bucket.media.arn}/media/*"
        ]
      }
    ]
  })
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-${var.environment}-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  db_name           = replace(var.project_name, "-", "")
  username          = var.db_username
  password          = var.db_password

  # Encrypt data at rest (free; AWS-managed KMS key).
  storage_encrypted = true

  vpc_security_group_ids = [aws_security_group.app_sg.id]
  publicly_accessible    = true

  backup_retention_period = var.environment == "production" ? 7 : 1
  apply_immediately       = true

  # Protect production from accidental deletion; take a final snapshot.
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-final" : null

  tags = {
    Name        = "${var.project_name}-${var.environment}-db"
    Environment = var.environment
  }
}

# Security Group
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-${var.environment}-sg"
  description = "Security group for ${var.project_name} ${var.environment}"

  # SSH — restricted to specific IPs
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
    description = "SSH access (restricted)"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # RDS — only from EC2 (self-referencing)
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    self        = true
    description = "PostgreSQL from within SG"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-sg"
    Environment = var.environment
  }
}
