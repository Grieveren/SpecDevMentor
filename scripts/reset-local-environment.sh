#!/bin/bash

# CodeMentor AI - Reset Local Environment Script
set -e

echo "🔄 Resetting CodeMentor AI Local Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Confirm reset
confirm_reset() {
    echo -e "${YELLOW}⚠️  WARNING: This will completely reset your local environment!${NC}"
    echo "This will:"
    echo "  - Stop all running services"
    echo "  - Remove all Docker containers and volumes"
    echo "  - Delete all database data"
    echo "  - Clear all logs"
    echo "  - Reset node_modules"
    echo ""
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Reset cancelled."
        exit 0
    fi
}

# Stop all services
stop_services() {
    print_status "Stopping all services..."
    
    # Stop production environment if running
    if [ -f scripts/stop-production-local.sh ]; then
        ./scripts/stop-production-local.sh 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    for port in 3000 3001 5432 6379; do
        if lsof -i :$port &> /dev/null; then
            print_warning "Killing process on port $port"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    print_success "Services stopped"
}

# Clean Docker environment
clean_docker() {
    print_status "Cleaning Docker environment..."
    
    # Stop and remove containers
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    
    # Remove specific containers if they exist
    for container in codementor-postgres codementor-redis codementor-server codementor-client; do
        if docker ps -a --format "table {{.Names}}" | grep -q "^$container$"; then
            print_status "Removing container: $container"
            docker rm -f $container 2>/dev/null || true
        fi
    done
    
    # Remove volumes
    for volume in $(docker volume ls -q | grep codementor); do
        print_status "Removing volume: $volume"
        docker volume rm $volume 2>/dev/null || true
    done
    
    # Clean up unused Docker resources
    docker system prune -f 2>/dev/null || true
    
    print_success "Docker environment cleaned"
}

# Clean file system
clean_filesystem() {
    print_status "Cleaning file system..."
    
    # Remove logs
    if [ -d logs ]; then
        rm -rf logs
        print_status "Removed logs directory"
    fi
    
    # Remove uploads
    if [ -d uploads ]; then
        rm -rf uploads
        print_status "Removed uploads directory"
    fi
    
    # Remove build artifacts
    if [ -d client/dist ]; then
        rm -rf client/dist
        print_status "Removed client build artifacts"
    fi
    
    if [ -d server/dist ]; then
        rm -rf server/dist
        print_status "Removed server build artifacts"
    fi
    
    # Remove node_modules
    if [ -d node_modules ]; then
        rm -rf node_modules
        print_status "Removed root node_modules"
    fi
    
    if [ -d client/node_modules ]; then
        rm -rf client/node_modules
        print_status "Removed client node_modules"
    fi
    
    if [ -d server/node_modules ]; then
        rm -rf server/node_modules
        print_status "Removed server node_modules"
    fi
    
    # Remove lock files
    rm -f pnpm-lock.yaml client/pnpm-lock.yaml server/pnpm-lock.yaml 2>/dev/null || true
    
    # Remove Prisma generated files
    if [ -d server/prisma/generated ]; then
        rm -rf server/prisma/generated
        print_status "Removed Prisma generated files"
    fi
    
    # Remove temporary files
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name ".DS_Store" -delete 2>/dev/null || true
    
    print_success "File system cleaned"
}

# Reset environment files
reset_environment() {
    print_status "Resetting environment files..."
    
    # Backup existing environment files
    if [ -f .env ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_status "Backed up .env file"
    fi
    
    if [ -f server/.env ]; then
        cp server/.env server/.env.backup.$(date +%Y%m%d_%H%M%S)
        print_status "Backed up server/.env file"
    fi
    
    # Remove environment files
    rm -f .env .env.production server/.env 2>/dev/null || true
    
    print_success "Environment files reset"
}

# Reinstall dependencies
reinstall_dependencies() {
    print_status "Reinstalling dependencies..."
    
    # Clear pnpm cache
    pnpm store prune 2>/dev/null || true
    
    # Install dependencies
    pnpm install --frozen-lockfile=false
    
    print_success "Dependencies reinstalled"
}

# Reset database schema
reset_database() {
    print_status "Resetting database schema..."
    
    # Start only database services
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    timeout=30
    while ! docker exec codementor-postgres pg_isready -U codementor -d codementor_ai &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Database failed to start"
            exit 1
        fi
    done
    
    # Reset Prisma
    cd server
    pnpm prisma generate
    pnpm prisma db push --force-reset
    cd ..
    
    print_success "Database schema reset"
}

# Display completion message
display_completion() {
    echo ""
    echo "✅ Environment reset completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update your environment variables in .env files"
    echo "2. Run: ./scripts/start-production-local.sh"
    echo ""
    echo "For setup instructions, see LOCAL_PRODUCTION_SETUP.md"
    echo ""
}

# Main execution
main() {
    echo "🔄 CodeMentor AI - Environment Reset"
    echo "==================================="
    
    confirm_reset
    stop_services
    clean_docker
    clean_filesystem
    reset_environment
    reinstall_dependencies
    reset_database
    display_completion
}

# Run main function
main "$@"