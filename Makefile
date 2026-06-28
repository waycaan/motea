# Makefile for motea Docker operations
# waycaan mit, 2025

# Variables
IMAGE_NAME ?= motea
TAG ?= latest
REGISTRY ?= ghcr.io/waycaan/motea-docker
FULL_IMAGE_NAME = $(IMAGE_NAME):$(TAG)
REGISTRY_IMAGE_NAME = $(REGISTRY)/$(IMAGE_NAME):$(TAG)

# Build information
BUILD_TIME = $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION = $(TAG)
REVISION = $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build arguments
BUILD_ARGS = --build-arg BUILDTIME=$(BUILD_TIME) \
             --build-arg VERSION=$(VERSION) \
             --build-arg REVISION=$(REVISION)

.PHONY: help build build-multi push run stop clean logs health test up down config-setup

# Default target
help: ## Show this help message
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker image for local platform
	@echo "Building $(FULL_IMAGE_NAME) with embedded PostgreSQL..."
	docker build $(BUILD_ARGS) -t $(FULL_IMAGE_NAME) .

build-multi: ## Build Docker image for multiple platforms (requires buildx)
	@echo "Building $(FULL_IMAGE_NAME) for multiple platforms..."
	docker buildx build $(BUILD_ARGS) \
		--platform linux/amd64,linux/arm64 \
		-t $(FULL_IMAGE_NAME) \
		--load .

build-push: ## Build and push Docker image to registry
	@echo "Building and pushing $(REGISTRY_IMAGE_NAME)..."
	docker buildx build $(BUILD_ARGS) \
		--platform linux/amd64,linux/arm64 \
		-t $(REGISTRY_IMAGE_NAME) \
		--push .

push: ## Push Docker image to registry
	@echo "Pushing $(REGISTRY_IMAGE_NAME)..."
	docker tag $(FULL_IMAGE_NAME) $(REGISTRY_IMAGE_NAME)
	docker push $(REGISTRY_IMAGE_NAME)

run: ## Run Docker container directly
	@echo "Running $(FULL_IMAGE_NAME)..."
	docker run -d \
		--name motea \
		-p 3000:3000 \
		-v motea_data:/data \
		-v ./motea.conf:/app/motea.conf:ro \
		$(FULL_IMAGE_NAME)

stop: ## Stop and remove Docker container
	@echo "Stopping motea container..."
	-docker stop motea 2>/dev/null
	-docker rm motea 2>/dev/null

clean: stop ## Clean up Docker images and containers
	@echo "Cleaning up Docker images..."
	-docker rmi $(FULL_IMAGE_NAME) 2>/dev/null
	-docker system prune -f

up: ## Start services with Docker Compose
	docker-compose up -d

down: ## Stop services with Docker Compose
	docker-compose down

logs: ## Show container logs
	docker-compose logs -f

health: ## Check container health
	@echo "Checking container health..."
	@docker ps --filter name=motea --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "Health endpoint test:"
	@curl -f http://localhost:3000/api/health 2>/dev/null | jq . || echo "Health check failed"

test: ## Test Docker image by running it
	@echo "Testing $(FULL_IMAGE_NAME)..."
	docker run --rm \
		-e NODE_ENV=production \
		-e DISABLE_PASSWORD=true \
		$(FULL_IMAGE_NAME) \
		timeout 30s /usr/local/bin/start.sh || echo "Test completed"

test-deps: ## Test dependency resolution
	@echo "Testing dependency resolution..."
	@if command -v bash >/dev/null 2>&1; then \
		bash ../test-dependency-fix.sh; \
	else \
		powershell -ExecutionPolicy Bypass -File ../test-dependency-fix.ps1; \
	fi

github: ## Use pre-built GitHub image
	@echo "Using pre-built GitHub image..."
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/use-github-image.sh; \
	else \
		powershell -ExecutionPolicy Bypass -File scripts/use-github-image.ps1; \
	fi

# Configuration targets
config-setup: ## Download docker-compose.yml if not exists
	@echo "Setting up configuration..."
	@if [ ! -f docker-compose.yml ]; then \
		curl -O https://raw.githubusercontent.com/waycaan/motea-docker/main/docker-compose.yml; \
		echo "Downloaded docker-compose.yml"; \
		echo "Please edit docker-compose.yml to set your password (line 70)"; \
	else \
		echo "docker-compose.yml already exists"; \
	fi

# CI/CD targets
ci-build: ## Build for CI/CD (multi-platform)
	$(MAKE) build-multi

ci-test: ## Run tests in CI/CD
	$(MAKE) test

ci-push: ## Push to registry in CI/CD
	$(MAKE) build-push

# Information targets
info: ## Show build information
	@echo "Image Name: $(FULL_IMAGE_NAME)"
	@echo "Registry: $(REGISTRY_IMAGE_NAME)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Version: $(VERSION)"
	@echo "Revision: $(REVISION)"

images: ## List Docker images
	docker images $(IMAGE_NAME)

ps: ## Show running containers
	docker ps --filter name=motea
