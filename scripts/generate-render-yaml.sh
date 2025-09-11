#!/bin/bash

# Generate render.yaml from template based on environment
# Usage: ./scripts/generate-render-yaml.sh <environment>
# Environment: dev, prod

set -e

ENVIRONMENT=${1:-prod}
TEMPLATE_FILE="render.yaml.template"
OUTPUT_FILE="render.yaml"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Template file $TEMPLATE_FILE not found"
    exit 1
fi

echo "Generating render.yaml for environment: $ENVIRONMENT"

# Set environment-specific variables
case $ENVIRONMENT in
    "dev")
        SERVICE_PREFIX="snoball-dev"
        PLAN_TIER="free"
        REDIS_PLAN="free"
        DEPLOY_BRANCH="dev"
        NODE_ENVIRONMENT="development"
        APP_ENVIRONMENT="development"
        ALPACA_ENDPOINT="https://paper-api.alpaca.markets"
        CRON_SCHEDULE='"0 */4 * * *"'  # Every 4 hours for dev
        ;;
    "prod")
        SERVICE_PREFIX="snoball-prod"
        PLAN_TIER="starter"
        REDIS_PLAN="starter"
        DEPLOY_BRANCH="main"
        NODE_ENVIRONMENT="production"
        APP_ENVIRONMENT="production"
        ALPACA_ENDPOINT="https://api.alpaca.markets"
        CRON_SCHEDULE='"*/30 * * * *"'  # Every 30 minutes for prod
        ;;
    *)
        echo "Error: Unknown environment '$ENVIRONMENT'. Use 'dev' or 'prod'"
        exit 1
        ;;
esac

# Generate render.yaml from template
cp "$TEMPLATE_FILE" "$OUTPUT_FILE"

# Replace placeholders with environment-specific values
# Use | as delimiter for sed to avoid issues with special characters
sed -i.bak \
    -e "s|{{SERVICE_PREFIX}}|$SERVICE_PREFIX|g" \
    -e "s|{{PLAN_TIER}}|$PLAN_TIER|g" \
    -e "s|{{REDIS_PLAN}}|$REDIS_PLAN|g" \
    -e "s|{{DEPLOY_BRANCH}}|$DEPLOY_BRANCH|g" \
    -e "s|{{NODE_ENVIRONMENT}}|$NODE_ENVIRONMENT|g" \
    -e "s|{{APP_ENVIRONMENT}}|$APP_ENVIRONMENT|g" \
    -e "s|{{ALPACA_ENDPOINT}}|$ALPACA_ENDPOINT|g" \
    -e "s|{{CRON_SCHEDULE}}|$CRON_SCHEDULE|g" \
    "$OUTPUT_FILE"

# Remove backup file
rm "$OUTPUT_FILE.bak"

echo "✅ Generated $OUTPUT_FILE for $ENVIRONMENT environment"
echo ""
echo "Configuration:"
echo "  Service Prefix: $SERVICE_PREFIX"
echo "  Plan Tier: $PLAN_TIER"
echo "  Deploy Branch: $DEPLOY_BRANCH"
echo "  Environment: $APP_ENVIRONMENT"
echo "  Alpaca Endpoint: $ALPACA_ENDPOINT"
echo "  Cron Schedule: $CRON_SCHEDULE"