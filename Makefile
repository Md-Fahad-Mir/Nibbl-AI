.PHONY: help up-local up-staging up-prod down logs \
        tf-plan tf-apply tf-destroy \
        ansible-prod ansible-staging \
        deploy-prod deploy-staging rollback \
        monitoring-up monitoring-down \
        chmod-scripts

# ─── Variables ────────────────────────────────────────────────────────
ENV         ?= production
PROJECT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

# ─── Help ─────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Nibbl AI Makefile — Available Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  Local Dev:"
	@echo "    make up-local         Start all services locally"
	@echo "    make down             Stop all services"
	@echo "    make logs             Follow all container logs"
	@echo ""
	@echo "  Docker Compose:"
	@echo "    make up-staging       Start staging compose"
	@echo "    make up-prod          Start production compose"
	@echo ""
	@echo "  Terraform:"
	@echo "    make tf-plan  ENV=production"
	@echo "    make tf-apply ENV=production"
	@echo "    make tf-destroy ENV=staging"
	@echo ""
	@echo "  Ansible:"
	@echo "    make ansible-prod     Configure production server"
	@echo "    make ansible-staging  Configure staging server"
	@echo ""
	@echo "  Deploy:"
	@echo "    make deploy-prod      Full production deploy"
	@echo "    make deploy-staging   Full staging deploy"
	@echo "    make rollback TAG=<backend-sha> [AI_IMAGE_TAG=<ai-sha>]  Rollback images"
	@echo ""
	@echo "  Monitoring:"
	@echo "    make monitoring-up    Start monitoring stack"
	@echo "    make monitoring-down  Stop monitoring stack"
	@echo ""

# ─── Local Dev ────────────────────────────────────────────────────────
up-local:
	docker compose \
		-f deployment/compose/docker-compose.base.yml \
		-f deployment/compose/local/docker-compose.yml \
		up --build

down:
	docker compose \
		-f deployment/compose/docker-compose.base.yml \
		-f deployment/compose/local/docker-compose.yml \
		down

logs:
	docker compose \
		-f deployment/compose/docker-compose.base.yml \
		-f deployment/compose/local/docker-compose.yml \
		logs -f

# ─── Remote Compose ───────────────────────────────────────────────────
up-staging:
	docker compose --env-file .env \
		-f deployment/compose/docker-compose.base.yml \
		-f deployment/compose/staging/docker-compose.yml \
		up -d

up-prod:
	docker compose --env-file .env \
		-f deployment/compose/docker-compose.base.yml \
		-f deployment/compose/production/docker-compose.yml \
		up -d

# ─── Terraform ────────────────────────────────────────────────────────
tf-plan:
	cd infrastructure/terraform/environments/$(ENV) && \
		terraform init -backend-config=backend.hcl && terraform plan

tf-apply:
	bash deployment/scripts/terraform-apply.sh $(ENV)

tf-destroy:
	bash deployment/scripts/terraform-destroy.sh $(ENV)

# ─── Ansible ──────────────────────────────────────────────────────────
ansible-prod:
	bash deployment/scripts/configure-server.sh production

ansible-staging:
	bash deployment/scripts/configure-server.sh staging

# ─── Full Deploy ──────────────────────────────────────────────────────
deploy-prod:
	bash deployment/scripts/deploy.sh production

deploy-staging:
	bash deployment/scripts/deploy.sh staging

rollback:
	bash deployment/scripts/rollback.sh $(TAG)

# ─── Monitoring ───────────────────────────────────────────────────────
monitoring-up:
	docker compose -f deployment/monitoring/docker-compose.monitoring.yml up -d

monitoring-down:
	docker compose -f deployment/monitoring/docker-compose.monitoring.yml down

# ─── Utilities ────────────────────────────────────────────────────────
chmod-scripts:
	chmod +x deployment/scripts/*.sh
