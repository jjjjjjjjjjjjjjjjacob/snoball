#!/bin/bash

# Script to set up local development environment without AWS

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

# Start local PostgreSQL
start_postgres() {
    print_message "$BLUE" "\n=== Starting PostgreSQL ==="
    
    if docker ps | grep -q postgres-snoball; then
        print_message "$YELLOW" "PostgreSQL already running"
    else
        docker run -d \
            --name postgres-snoball \
            -e POSTGRES_DB=snoball \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=localpassword \
            -p 5432:5432 \
            postgres:15-alpine
        
        print_message "$GREEN" "✅ PostgreSQL started"
        
        # Wait for PostgreSQL to be ready
        print_message "$YELLOW" "Waiting for PostgreSQL to be ready..."
        sleep 5
    fi
}

# Start local Redis
start_redis() {
    print_message "$BLUE" "\n=== Starting Redis ==="
    
    if docker ps | grep -q redis-snoball; then
        print_message "$YELLOW" "Redis already running"
    else
        docker run -d \
            --name redis-snoball \
            -p 6379:6379 \
            redis:alpine
        
        print_message "$GREEN" "✅ Redis started"
    fi
}

# Create local .env file
create_env_file() {
    print_message "$BLUE" "\n=== Creating .env.local ==="
    
    cat > "$PROJECT_ROOT/.env.local" <<EOF
# Database (Local)
DATABASE_URL=postgresql://postgres:localpassword@localhost:5432/snoball
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=snoball
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=localpassword

# Redis (Local)
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
ENVIRONMENT=local

# API URL
API_URL=http://localhost:3000

# Alpaca (Paper Trading)
ALPACA_API_KEY=${ALPACA_API_KEY:-your-alpaca-api-key}
ALPACA_SECRET_KEY=${ALPACA_SECRET_KEY:-your-alpaca-secret-key}
ALPACA_ENDPOINT=https://paper-api.alpaca.markets

# LLM APIs (Optional)
OPENAI_API_KEY=${OPENAI_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}

# Encryption Key (Local Only - DO NOT USE IN PRODUCTION)
ENCRYPTION_KEY=local-dev-encryption-key-32-chars!!
EOF
    
    print_message "$GREEN" "✅ Created .env.local"
}

# Run database migrations
run_migrations() {
    print_message "$BLUE" "\n=== Running Database Migrations ==="
    
    cd "$PROJECT_ROOT"
    
    # Check if packages/database exists
    if [ -d "packages/database" ]; then
        cd packages/database
        
        # Run migrations
        if [ -f "migrations.ts" ]; then
            bun run migrations.ts || npm run migrate:deploy
            print_message "$GREEN" "✅ Migrations completed"
        else
            print_message "$YELLOW" "⚠️  No migrations found"
        fi
    else
        print_message "$YELLOW" "⚠️  Database package not found"
    fi
}

# Install dependencies
install_dependencies() {
    print_message "$BLUE" "\n=== Installing Dependencies ==="
    
    cd "$PROJECT_ROOT"
    
    if command -v bun &> /dev/null; then
        bun install
        print_message "$GREEN" "✅ Dependencies installed with Bun"
    elif command -v npm &> /dev/null; then
        npm install
        print_message "$GREEN" "✅ Dependencies installed with npm"
    else
        print_message "$RED" "❌ No package manager found (bun or npm required)"
        exit 1
    fi
}

# Start development servers
start_dev_servers() {
    print_message "$BLUE" "\n=== Starting Development Servers ==="
    
    cd "$PROJECT_ROOT"
    
    # Start in development mode
    if command -v bun &> /dev/null; then
        print_message "$YELLOW" "Starting with Bun..."
        bun run dev
    else
        print_message "$YELLOW" "Starting with npm..."
        npm run dev
    fi
}

# Stop local services
stop_services() {
    print_message "$BLUE" "\n=== Stopping Local Services ==="
    
    # Stop PostgreSQL
    if docker ps | grep -q postgres-snoball; then
        docker stop postgres-snoball
        docker rm postgres-snoball
        print_message "$GREEN" "✅ PostgreSQL stopped"
    fi
    
    # Stop Redis
    if docker ps | grep -q redis-snoball; then
        docker stop redis-snoball
        docker rm redis-snoball
        print_message "$GREEN" "✅ Redis stopped"
    fi
}

# Show menu
show_menu() {
    echo ""
    print_message "$BLUE" "==================================="
    print_message "$BLUE" "    Local Development Setup        "
    print_message "$BLUE" "==================================="
    echo ""
    echo "1) Start all services"
    echo "2) Start PostgreSQL only"
    echo "3) Start Redis only"
    echo "4) Run migrations"
    echo "5) Start dev servers"
    echo "6) Stop all services"
    echo "7) Full setup (all of the above)"
    echo "8) Exit"
    echo ""
    read -p "Select an option: " choice
}

# Handle menu selection
handle_selection() {
    case $choice in
        1)
            start_postgres
            start_redis
            create_env_file
            ;;
        2)
            start_postgres
            ;;
        3)
            start_redis
            ;;
        4)
            run_migrations
            ;;
        5)
            start_dev_servers
            ;;
        6)
            stop_services
            ;;
        7)
            start_postgres
            start_redis
            create_env_file
            install_dependencies
            run_migrations
            start_dev_servers
            ;;
        8)
            print_message "$GREEN" "Goodbye!"
            exit 0
            ;;
        *)
            print_message "$RED" "Invalid option"
            ;;
    esac
}

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_message "$RED" "❌ Docker is required for local development"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_message "$RED" "❌ Docker daemon is not running"
        echo "Please start Docker Desktop"
        exit 1
    fi
}

# Main execution
main() {
    print_message "$BLUE" "==================================="
    print_message "$BLUE" "    Local Development Setup        "
    print_message "$BLUE" "==================================="
    
    # Check Docker
    check_docker
    
    # Check for command line arguments
    if [ $# -gt 0 ]; then
        case $1 in
            start)
                start_postgres
                start_redis
                create_env_file
                install_dependencies
                run_migrations
                start_dev_servers
                ;;
            stop)
                stop_services
                ;;
            migrate)
                run_migrations
                ;;
            *)
                print_message "$RED" "Unknown command: $1"
                echo "Usage: $0 [start|stop|migrate]"
                exit 1
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