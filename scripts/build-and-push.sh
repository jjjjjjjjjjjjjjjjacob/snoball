#!/bin/bash

# Script to build and push Docker images to ECR

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"

print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Get ECR repositories from bootstrap outputs
get_ecr_repositories() {
  if [ ! -f "$TERRAFORM_DIR/bootstrap-outputs.json" ]; then
    print_message "$RED" "❌ Bootstrap outputs not found. Please run setup.sh first."
    exit 1
  fi

  ECR_TRADE_SERVER=$(jq -r '.ecr_repositories.value."snoball/trade-server"' "$TERRAFORM_DIR/bootstrap-outputs.json")
  ECR_WEB=$(jq -r '.ecr_repositories.value."snoball/web"' "$TERRAFORM_DIR/bootstrap-outputs.json")
  ECR_ANALYSIS=$(jq -r '.ecr_repositories.value."snoball/analysis-engine"' "$TERRAFORM_DIR/bootstrap-outputs.json")
  ECR_MARKET=$(jq -r '.ecr_repositories.value."snoball/market-data"' "$TERRAFORM_DIR/bootstrap-outputs.json")

  # Extract registry URL
  ECR_REGISTRY=$(echo $ECR_TRADE_SERVER | cut -d'/' -f1)
  AWS_REGION=$(echo $ECR_REGISTRY | cut -d'.' -f4)
}

# Login to ECR
ecr_login() {
  print_message "$BLUE" "\n=== Logging into ECR ==="

  aws ecr get-login-password --region $AWS_REGION |
    docker login --username AWS --password-stdin $ECR_REGISTRY

  if [ $? -eq 0 ]; then
    print_message "$GREEN" "✅ Successfully logged into ECR"
  else
    print_message "$RED" "❌ Failed to login to ECR"
    exit 1
  fi
}

# Build and push a Docker image
build_and_push() {
  local app_name=$1
  local app_dir=$2
  local ecr_url=$3
  local tag=${4:-latest}

  print_message "$BLUE" "\n=== Building $app_name ==="

  cd "$PROJECT_ROOT/$app_dir"

  # Check if Dockerfile exists
  if [ ! -f "Dockerfile" ]; then
    print_message "$YELLOW" "⚠️  No Dockerfile found for $app_name, creating one..."
    create_dockerfile "$app_name" "$app_dir"
  fi

  # Build the image
  print_message "$YELLOW" "Building Docker image..."
  docker build -t $app_name:$tag .

  # Tag for ECR
  docker tag $app_name:$tag $ecr_url:$tag

  # Also tag as latest if not already
  if [ "$tag" != "latest" ]; then
    docker tag $app_name:$tag $ecr_url:latest
  fi

  # Push to ECR
  print_message "$YELLOW" "Pushing to ECR..."
  docker push $ecr_url:$tag

  if [ "$tag" != "latest" ]; then
    docker push $ecr_url:latest
  fi

  print_message "$GREEN" "✅ Successfully built and pushed $app_name"
}

# Create a default Dockerfile if none exists
create_dockerfile() {
  local app_name=$1
  local app_dir=$2

  case $app_name in
  "trade-server")
    cat >Dockerfile <<'EOF'
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY ../packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build TypeScript
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Expose port
EXPOSE 9090

# Run the application
CMD ["bun", "run", "dist/index.js"]
EOF
    ;;

  "web")
    cat >Dockerfile <<'EOF'
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY ../packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Build Next.js application
RUN bun run build

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "start"]
EOF
    ;;

  "analysis-engine")
    cat >Dockerfile <<'EOF'
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY ../packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build TypeScript
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Expose port
EXPOSE 8081

# Run the application
CMD ["bun", "run", "dist/index.js"]
EOF
    ;;

  "market-data")
    cat >Dockerfile <<'EOF'
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY ../packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build TypeScript
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Expose port
EXPOSE 8082

# Run the application
CMD ["bun", "run", "dist/index.js"]
EOF
    ;;
  esac
}

# Main execution
main() {
  print_message "$BLUE" "==================================="
  print_message "$BLUE" "   Docker Build and Push Script    "
  print_message "$BLUE" "==================================="

  # Get version tag from argument or use latest
  TAG=${1:-latest}

  if [ "$TAG" != "latest" ]; then
    print_message "$YELLOW" "Using tag: $TAG"
  fi

  # Get ECR repositories
  get_ecr_repositories

  # Login to ECR
  ecr_login

  # Build and push each application
  if [ -d "$PROJECT_ROOT/apps/trade-server" ]; then
    build_and_push "trade-server" "apps/trade-server" "$ECR_TRADE_SERVER" "$TAG"
  else
    print_message "$YELLOW" "⚠️  Trade server directory not found"
  fi

  if [ -d "$PROJECT_ROOT/apps/web" ]; then
    build_and_push "web" "apps/web" "$ECR_WEB" "$TAG"
  else
    print_message "$YELLOW" "⚠️  Web application directory not found"
  fi

  if [ -d "$PROJECT_ROOT/services/analysis-engine" ]; then
    build_and_push "analysis-engine" "services/analysis-engine" "$ECR_ANALYSIS" "$TAG"
  else
    print_message "$YELLOW" "⚠️  Analysis engine directory not found"
  fi

  if [ -d "$PROJECT_ROOT/services/market-data" ]; then
    build_and_push "market-data" "services/market-data" "$ECR_MARKET" "$TAG"
  else
    print_message "$YELLOW" "⚠️  Market data service directory not found"
  fi

  print_message "$GREEN" "\n✅ All images built and pushed successfully!"
  print_message "$YELLOW" "\nNext step: Deploy to ECS with ./scripts/deploy-ecs.sh"
}

# Run main function
main "$@"
