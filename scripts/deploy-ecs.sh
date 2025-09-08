#!/bin/bash

# Script to deploy services to ECS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Get infrastructure outputs
get_infrastructure_outputs() {
    if [ ! -f "$PROJECT_ROOT/infrastructure-outputs.json" ]; then
        print_message "$RED" "❌ Infrastructure outputs not found. Please run setup.sh first."
        exit 1
    fi
    
    ECS_CLUSTER=$(jq -r '.ecs_cluster_name.value // empty' "$PROJECT_ROOT/infrastructure-outputs.json")
    
    if [ -z "$ECS_CLUSTER" ]; then
        print_message "$RED" "❌ ECS cluster not found in outputs"
        exit 1
    fi
}

# Deploy a service to ECS
deploy_service() {
    local service_name=$1
    local tag=${2:-latest}
    
    print_message "$BLUE" "\n=== Deploying $service_name ==="
    
    # Check if service exists
    if aws ecs describe-services --cluster $ECS_CLUSTER --services $service_name &> /dev/null; then
        print_message "$YELLOW" "Updating existing service..."
        
        # Force new deployment
        aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $service_name \
            --force-new-deployment \
            --query 'service.deployments[0].{Status:status,TaskDef:taskDefinition}' \
            --output table
        
        print_message "$GREEN" "✅ Deployment initiated for $service_name"
    else
        print_message "$YELLOW" "⚠️  Service $service_name not found in cluster"
    fi
}

# Wait for deployment to complete
wait_for_deployment() {
    local service_name=$1
    local max_attempts=60
    local attempt=0
    
    print_message "$YELLOW" "Waiting for $service_name deployment to complete..."
    
    while [ $attempt -lt $max_attempts ]; do
        # Get deployment status
        DEPLOYMENT_COUNT=$(aws ecs describe-services \
            --cluster $ECS_CLUSTER \
            --services $service_name \
            --query 'services[0].deployments | length(@)' \
            --output text)
        
        if [ "$DEPLOYMENT_COUNT" -eq "1" ]; then
            STATUS=$(aws ecs describe-services \
                --cluster $ECS_CLUSTER \
                --services $service_name \
                --query 'services[0].deployments[0].rolloutState' \
                --output text)
            
            if [ "$STATUS" == "COMPLETED" ]; then
                print_message "$GREEN" "✅ Deployment completed for $service_name"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 10
    done
    
    print_message "$RED" "❌ Deployment timeout for $service_name"
    return 1
}

# Get service status
get_service_status() {
    local service_name=$1
    
    print_message "$BLUE" "\n=== Status for $service_name ==="
    
    aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $service_name \
        --query 'services[0].{Service:serviceName,Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount}' \
        --output table
}

# Scale a service
scale_service() {
    local service_name=$1
    local count=$2
    
    print_message "$BLUE" "\n=== Scaling $service_name to $count instances ==="
    
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $service_name \
        --desired-count $count \
        --query 'service.{Service:serviceName,DesiredCount:desiredCount}' \
        --output table
    
    print_message "$GREEN" "✅ Scaled $service_name to $count instances"
}

# View logs for a service
view_logs() {
    local service_name=$1
    local lines=${2:-50}
    
    print_message "$BLUE" "\n=== Recent logs for $service_name ==="
    
    LOG_GROUP="/ecs/$service_name"
    
    # Get the latest log stream
    LATEST_STREAM=$(aws logs describe-log-streams \
        --log-group-name $LOG_GROUP \
        --order-by LastEventTime \
        --descending \
        --limit 1 \
        --query 'logStreams[0].logStreamName' \
        --output text)
    
    if [ ! -z "$LATEST_STREAM" ]; then
        aws logs tail $LOG_GROUP --log-stream-names $LATEST_STREAM --format short | tail -n $lines
    else
        print_message "$YELLOW" "⚠️  No logs found for $service_name"
    fi
}

# Main menu
show_menu() {
    echo ""
    print_message "$BLUE" "==================================="
    print_message "$BLUE" "       ECS Deployment Menu         "
    print_message "$BLUE" "==================================="
    echo ""
    echo "1) Deploy all services"
    echo "2) Deploy trade-server"
    echo "3) Deploy web application"
    echo "4) Deploy analysis-engine"
    echo "5) Deploy market-data"
    echo "6) View service status"
    echo "7) Scale services"
    echo "8) View logs"
    echo "9) Exit"
    echo ""
    read -p "Select an option: " choice
}

# Handle menu selection
handle_selection() {
    case $choice in
        1)
            deploy_service "trade-server"
            deploy_service "web"
            deploy_service "analysis-engine"
            deploy_service "market-data"
            ;;
        2)
            deploy_service "trade-server"
            wait_for_deployment "trade-server"
            ;;
        3)
            deploy_service "web"
            wait_for_deployment "web"
            ;;
        4)
            deploy_service "analysis-engine"
            wait_for_deployment "analysis-engine"
            ;;
        5)
            deploy_service "market-data"
            wait_for_deployment "market-data"
            ;;
        6)
            get_service_status "trade-server"
            get_service_status "web"
            get_service_status "analysis-engine"
            get_service_status "market-data"
            ;;
        7)
            read -p "Enter service name: " service
            read -p "Enter desired count: " count
            scale_service "$service" "$count"
            ;;
        8)
            read -p "Enter service name: " service
            read -p "Number of lines to show (default 50): " lines
            lines=${lines:-50}
            view_logs "$service" "$lines"
            ;;
        9)
            print_message "$GREEN" "Goodbye!"
            exit 0
            ;;
        *)
            print_message "$RED" "Invalid option"
            ;;
    esac
}

# Main execution
main() {
    # Get infrastructure outputs
    get_infrastructure_outputs
    
    # Check if running with arguments
    if [ $# -gt 0 ]; then
        case $1 in
            all)
                deploy_service "trade-server"
                deploy_service "web"
                deploy_service "analysis-engine"
                deploy_service "market-data"
                ;;
            status)
                get_service_status "trade-server"
                get_service_status "web"
                get_service_status "analysis-engine"
                get_service_status "market-data"
                ;;
            logs)
                service=${2:-trade-server}
                lines=${3:-50}
                view_logs "$service" "$lines"
                ;;
            scale)
                service=$2
                count=$3
                if [ -z "$service" ] || [ -z "$count" ]; then
                    print_message "$RED" "Usage: $0 scale <service> <count>"
                    exit 1
                fi
                scale_service "$service" "$count"
                ;;
            *)
                deploy_service "$1"
                wait_for_deployment "$1"
                ;;
        esac
    else
        # Interactive menu
        while true; do
            show_menu
            handle_selection
        done
    fi
}

# Run main function
main "$@"