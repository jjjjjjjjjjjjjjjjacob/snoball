#!/bin/bash

# Snoball Trade Server - Render Deployment Script
set -e

echo "🚀 Deploying Snoball Trading Platform to Render..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "render.yaml" ]; then
    print_error "render.yaml not found. Please run this script from the project root directory."
    exit 1
fi

# Check if Git is initialized and has commits
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This is not a Git repository. Please initialize Git first."
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Consider committing them before deployment."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Validating render.yaml configuration..."

# Basic validation of render.yaml
if ! command -v yq &> /dev/null; then
    print_warning "yq not installed. Skipping render.yaml validation."
else
    # Validate YAML syntax
    if yq eval '.' render.yaml > /dev/null 2>&1; then
        print_success "render.yaml syntax is valid"
        
        # Check for required services
        services=$(yq eval '.services | length' render.yaml)
        print_status "Found $services services in render.yaml"
    else
        print_error "render.yaml has syntax errors"
        exit 1
    fi
fi

print_status "Checking required environment variables..."

# List of required environment variables
REQUIRED_ENV_VARS=(
    "DATABASE_URL"
    "ALPACA_API_KEY"
    "ALPACA_SECRET_KEY"
    "WORKOS_API_KEY"
    "WORKOS_CLIENT_ID"
    "WORKOS_WEBHOOK_SECRET"
    "ENCRYPTION_KEY"
    "NEXTAUTH_SECRET"
)

# Check local .env file for reference
if [ -f ".env.local" ]; then
    print_status "Found .env.local file"
    
    missing_vars=()
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if ! grep -q "^$var=" .env.local 2>/dev/null; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_warning "Missing variables in .env.local:"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
    else
        print_success "All required variables found in .env.local"
    fi
else
    print_warning ".env.local not found. Make sure to set environment variables in Render dashboard."
fi

print_status "Preparing for deployment..."

# Ensure we're on the main branch for production deployment
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    print_warning "You're on branch '$CURRENT_BRANCH'. Render typically deploys from 'main' or 'master'."
    read -p "Continue with current branch? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Switch to main branch and try again"
        exit 1
    fi
fi

# Push to remote if there are local commits ahead
LOCAL_COMMITS=$(git rev-list --count HEAD ^origin/$CURRENT_BRANCH 2>/dev/null || echo "0")
if [ "$LOCAL_COMMITS" -gt "0" ]; then
    print_status "You have $LOCAL_COMMITS local commits. Pushing to origin..."
    git push origin $CURRENT_BRANCH
    print_success "Pushed to remote repository"
fi

print_success "Repository is ready for Render deployment!"

echo ""
print_status "Next steps:"
echo "1. 🌐 Go to https://dashboard.render.com"
echo "2. 📂 Connect your GitHub repository"
echo "3. 🔧 Import services from render.yaml"
echo "4. 🔐 Set environment variables in each service:"

for var in "${REQUIRED_ENV_VARS[@]}"; do
    echo "     - $var"
done

echo ""
echo "5. 🚀 Deploy services in this order:"
echo "     a) Redis cache"
echo "     b) Trade server (web service)"
echo "     c) Background worker"
echo "     d) Market analysis (cron job)"

echo ""
print_status "Environment variable templates:"
echo ""
echo "DATABASE_URL:"
echo "  postgresql://user:pass@aws-us-east-1-portal.23.psdb.cloud/database?sslmode=require"
echo ""
echo "REDIS_URL (automatically set by Render Redis service):"
echo "  redis://red-xxxxx:6379"
echo ""
echo "Generate secrets:"
echo "  ENCRYPTION_KEY: openssl rand -hex 32"
echo "  NEXTAUTH_SECRET: openssl rand -hex 32"

echo ""
print_success "Deployment preparation complete!"
print_status "Your services will auto-deploy when you push to the main branch."

echo ""
echo "📊 Expected costs on Render:"
echo "   • Trade server: \$7/month"
echo "   • Background worker: \$7/month"
echo "   • Cron job: \$7/month"
echo "   • Redis: \$7/month"
echo "   • Total: ~\$28/month"

echo ""
print_status "Monitor your deployment at: https://dashboard.render.com"