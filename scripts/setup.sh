#!/bin/bash

# Snoball Infrastructure Setup Script
# This script automates the entire infrastructure setup process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"
BOOTSTRAP_DIR="$TERRAFORM_DIR/bootstrap"

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_message "$BLUE" "\n=== Checking Prerequisites ==="
    
    # Check for AWS CLI
    if ! command -v aws &> /dev/null; then
        print_message "$RED" "❌ AWS CLI is not installed"
        echo "Please install AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
    print_message "$GREEN" "✅ AWS CLI found"
    
    # Check for Terraform
    if ! command -v terraform &> /dev/null; then
        print_message "$RED" "❌ Terraform is not installed"
        echo "Please install Terraform: https://www.terraform.io/downloads"
        exit 1
    fi
    print_message "$GREEN" "✅ Terraform found"
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        print_message "$RED" "❌ jq is not installed"
        echo "Please install jq: https://stedolan.github.io/jq/"
        exit 1
    fi
    print_message "$GREEN" "✅ jq found"
    
    # Check for Docker
    if ! command -v docker &> /dev/null; then
        print_message "$YELLOW" "⚠️  Docker is not installed (optional for local development)"
    else
        print_message "$GREEN" "✅ Docker found"
    fi
}

# Function to setup AWS credentials
setup_aws_credentials() {
    print_message "$BLUE" "\n=== Setting up AWS Credentials ==="
    
    # Check if AWS credentials are already configured
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        CURRENT_USER=$(aws sts get-caller-identity --query Arn --output text)
        print_message "$GREEN" "✅ AWS credentials configured"
        print_message "$GREEN" "   Account ID: $ACCOUNT_ID"
        print_message "$GREEN" "   Current User: $CURRENT_USER"
        
        read -p "Do you want to use these credentials? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            configure_aws_credentials
        fi
    else
        print_message "$YELLOW" "AWS credentials not found"
        configure_aws_credentials
    fi
}

# Function to configure AWS credentials
configure_aws_credentials() {
    read -p "Enter AWS Access Key ID: " AWS_ACCESS_KEY_ID
    read -s -p "Enter AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo
    read -p "Enter AWS Region (default: us-east-1): " AWS_REGION
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION=$AWS_REGION
    
    # Verify credentials
    if aws sts get-caller-identity &> /dev/null; then
        print_message "$GREEN" "✅ AWS credentials verified"
    else
        print_message "$RED" "❌ Invalid AWS credentials"
        exit 1
    fi
}

# Function to collect API keys
collect_api_keys() {
    print_message "$BLUE" "\n=== Collecting API Keys ==="
    
    # Check if terraform.tfvars exists
    if [ -f "$BOOTSTRAP_DIR/terraform.tfvars" ]; then
        print_message "$YELLOW" "Found existing terraform.tfvars"
        read -p "Do you want to use the existing configuration? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    # Alpaca API Keys
    print_message "$YELLOW" "\nAlpaca Markets API Keys (required for trading)"
    echo "Get your keys from: https://app.alpaca.markets"
    read -p "Enter Alpaca API Key: " ALPACA_API_KEY
    read -s -p "Enter Alpaca Secret Key: " ALPACA_SECRET_KEY
    echo
    read -p "Use paper trading? (y/n, default: y): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        ALPACA_ENDPOINT="https://api.alpaca.markets"
        print_message "$YELLOW" "⚠️  Using LIVE trading endpoint"
    else
        ALPACA_ENDPOINT="https://paper-api.alpaca.markets"
        print_message "$GREEN" "✅ Using paper trading endpoint"
    fi
    
    # LLM API Keys (optional)
    print_message "$YELLOW" "\nLLM API Keys (optional - press Enter to skip)"
    read -p "Enter OpenAI API Key (optional): " OPENAI_API_KEY
    read -p "Enter Anthropic API Key (optional): " ANTHROPIC_API_KEY
    
    # Create terraform.tfvars
    cat > "$BOOTSTRAP_DIR/terraform.tfvars" <<EOF
# AWS Configuration
aws_region = "$AWS_DEFAULT_REGION"

# Alpaca Trading API
alpaca_api_key    = "$ALPACA_API_KEY"
alpaca_secret_key = "$ALPACA_SECRET_KEY"
alpaca_endpoint   = "$ALPACA_ENDPOINT"

# LLM APIs
openai_api_key    = "$OPENAI_API_KEY"
anthropic_api_key = "$ANTHROPIC_API_KEY"
EOF
    
    print_message "$GREEN" "✅ Configuration saved to terraform.tfvars"
}

# Function to run bootstrap Terraform
run_bootstrap() {
    print_message "$BLUE" "\n=== Running Bootstrap Terraform ==="
    
    cd "$BOOTSTRAP_DIR"
    
    # Initialize Terraform
    print_message "$YELLOW" "Initializing Terraform..."
    terraform init
    
    # Plan
    print_message "$YELLOW" "Planning infrastructure..."
    terraform plan -out=tfplan
    
    # Apply
    print_message "$YELLOW" "Creating bootstrap infrastructure..."
    read -p "Do you want to apply these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply tfplan
        
        # Save outputs
        terraform output -json > "$TERRAFORM_DIR/bootstrap-outputs.json"
        print_message "$GREEN" "✅ Bootstrap infrastructure created"
    else
        print_message "$RED" "❌ Bootstrap cancelled"
        exit 1
    fi
}

# Function to deploy main infrastructure
deploy_main_infrastructure() {
    print_message "$BLUE" "\n=== Deploying Main Infrastructure ==="
    
    cd "$TERRAFORM_DIR"
    
    # Get bootstrap outputs
    STATE_BUCKET=$(jq -r '.state_bucket_name.value' bootstrap-outputs.json)
    LOCK_TABLE=$(jq -r '.lock_table_name.value' bootstrap-outputs.json)
    ECR_TRADE_SERVER=$(jq -r '.ecr_repositories.value."snoball/trade-server"' bootstrap-outputs.json)
    
    # Select environment
    read -p "Enter environment name (dev/staging/production): " ENVIRONMENT
    ENVIRONMENT=${ENVIRONMENT:-dev}
    
    # Initialize with backend
    print_message "$YELLOW" "Initializing Terraform with backend..."
    terraform init \
        -backend-config="bucket=$STATE_BUCKET" \
        -backend-config="key=terraform.tfstate" \
        -backend-config="region=$AWS_DEFAULT_REGION" \
        -backend-config="dynamodb_table=$LOCK_TABLE"
    
    # Create/select workspace
    terraform workspace select $ENVIRONMENT 2>/dev/null || terraform workspace new $ENVIRONMENT
    
    # Update environment tfvars with ECR URL
    if [ ! -f "environments/$ENVIRONMENT/terraform.tfvars" ]; then
        mkdir -p "environments/$ENVIRONMENT"
        cat > "environments/$ENVIRONMENT/terraform.tfvars" <<EOF
environment = "$ENVIRONMENT"
aws_region  = "$AWS_DEFAULT_REGION"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

# Container Configuration
ecr_repository_url = "$ECR_TRADE_SERVER"
image_tag = "latest"
EOF
    fi
    
    # Plan
    print_message "$YELLOW" "Planning main infrastructure..."
    terraform plan -var-file="environments/$ENVIRONMENT/terraform.tfvars" -out=tfplan
    
    # Apply
    read -p "Do you want to deploy the main infrastructure? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply tfplan
        
        # Save outputs
        terraform output -json > "$PROJECT_ROOT/infrastructure-outputs.json"
        print_message "$GREEN" "✅ Main infrastructure deployed"
    else
        print_message "$YELLOW" "⚠️  Skipping main infrastructure deployment"
    fi
}

# Function to setup local environment
setup_local_environment() {
    print_message "$BLUE" "\n=== Setting up Local Environment ==="
    
    cd "$PROJECT_ROOT"
    
    # Get infrastructure outputs
    if [ -f "infrastructure-outputs.json" ]; then
        DATABASE_URL=$(jq -r '.database_url.value // empty' infrastructure-outputs.json)
        REDIS_URL=$(jq -r '.redis_url.value // empty' infrastructure-outputs.json)
        ALB_DNS=$(jq -r '.alb_dns_name.value // empty' infrastructure-outputs.json)
    fi
    
    # Create .env.local
    cat > .env.local <<EOF
# Database
DATABASE_URL=${DATABASE_URL:-postgresql://localhost:5432/snoball}
DATABASE_HOST=${DATABASE_HOST:-localhost}
DATABASE_PORT=5432
DATABASE_NAME=snoball
DATABASE_USERNAME=postgres

# Redis
REDIS_URL=${REDIS_URL:-redis://localhost:6379}

# AWS
AWS_REGION=$AWS_DEFAULT_REGION
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Application
NODE_ENV=development
ENVIRONMENT=$ENVIRONMENT

# API URL
API_URL=${ALB_DNS:-http://localhost:3000}
EOF
    
    print_message "$GREEN" "✅ Created .env.local"
    
    # Install dependencies
    if command -v bun &> /dev/null; then
        print_message "$YELLOW" "Installing dependencies with Bun..."
        bun install
    elif command -v npm &> /dev/null; then
        print_message "$YELLOW" "Installing dependencies with npm..."
        npm install
    fi
}

# Function to run database migrations
run_migrations() {
    print_message "$BLUE" "\n=== Running Database Migrations ==="
    
    if [ -z "$DATABASE_URL" ]; then
        print_message "$YELLOW" "⚠️  No database URL found, skipping migrations"
        return
    fi
    
    cd "$PROJECT_ROOT"
    
    read -p "Do you want to run database migrations? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        bun run migrate:deploy || npm run migrate:deploy
        print_message "$GREEN" "✅ Database migrations completed"
    fi
}

# Function to display next steps
display_next_steps() {
    print_message "$BLUE" "\n=== Setup Complete! ==="
    print_message "$GREEN" "\n✅ Infrastructure has been successfully deployed"
    
    print_message "$YELLOW" "\n📋 Next Steps:"
    echo "1. Build and push Docker images:"
    echo "   ./scripts/build-and-push.sh"
    echo ""
    echo "2. Start local development:"
    echo "   bun run dev"
    echo ""
    echo "3. Deploy to ECS:"
    echo "   ./scripts/deploy-ecs.sh"
    echo ""
    echo "4. View infrastructure:"
    echo "   cd infrastructure/terraform"
    echo "   terraform show"
    echo ""
    echo "5. Destroy infrastructure (when done):"
    echo "   ./scripts/teardown.sh"
    
    print_message "$GREEN" "\n🚀 Happy trading!"
}

# Main execution
main() {
    print_message "$BLUE" "==================================="
    print_message "$BLUE" "   Snoball Infrastructure Setup    "
    print_message "$BLUE" "==================================="
    
    check_prerequisites
    setup_aws_credentials
    collect_api_keys
    run_bootstrap
    deploy_main_infrastructure
    setup_local_environment
    run_migrations
    display_next_steps
}

# Run main function
main "$@"