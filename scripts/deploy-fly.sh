#!/bin/bash

# Snoball Trade Server - Fly.io Deployment Script
set -e

echo "🚀 Deploying Snoball Trade Server to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is logged in
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run: flyctl auth login"
    exit 1
fi

# Check if app exists, if not create it
APP_NAME="snoball-trade-server"
if ! flyctl apps list | grep -q "$APP_NAME"; then
    echo "📱 Creating new Fly.io app: $APP_NAME"
    flyctl apps create "$APP_NAME" --generate-name=false
fi

# Set secrets if they don't exist
echo "🔐 Setting up secrets..."

# Check for required environment variables
REQUIRED_SECRETS=(
    "DATABASE_URL"
    "ALPACA_API_KEY" 
    "ALPACA_SECRET_KEY"
    "WORKOS_API_KEY"
    "WORKOS_CLIENT_ID"
    "WORKOS_WEBHOOK_SECRET"
    "ENCRYPTION_KEY"
    "NEXTAUTH_SECRET"
)

MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! flyctl secrets list | grep -q "$secret"; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -ne 0 ]; then
    echo "❌ Missing required secrets. Please set them first:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "   flyctl secrets set $secret=your_value_here"
    done
    echo ""
    echo "💡 Example commands:"
    echo "   flyctl secrets set DATABASE_URL=postgresql://user:pass@host:5432/db"
    echo "   flyctl secrets set ALPACA_API_KEY=your_alpaca_key"
    echo "   flyctl secrets set ENCRYPTION_KEY=\$(openssl rand -hex 32)"
    echo "   flyctl secrets set NEXTAUTH_SECRET=\$(openssl rand -hex 32)"
    exit 1
fi

# Optional: Set Redis URL if using Upstash
if [ -n "$REDIS_URL" ] && ! flyctl secrets list | grep -q "REDIS_URL"; then
    echo "📝 Setting Redis URL..."
    flyctl secrets set REDIS_URL="$REDIS_URL"
fi

# Deploy the application
echo "🏗️  Building and deploying..."
flyctl deploy --build-arg NODE_ENV=production

# Check deployment status
echo "✅ Deployment complete!"
echo ""
echo "📊 App status:"
flyctl status

echo ""
echo "🔗 App URL:"
flyctl info | grep "Hostname" | awk '{print $2}' | sed 's/^/https:\/\//'

echo ""
echo "📋 Useful commands:"
echo "   flyctl logs       - View logs"
echo "   flyctl ssh console - SSH into the app"
echo "   flyctl status     - Check app status"
echo "   flyctl scale count 2 - Scale to 2 instances"
echo ""
echo "✅ Trade server deployed successfully!"