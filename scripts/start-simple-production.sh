#!/bin/bash

# CodeMentor AI - Simplified Production Environment Startup Script
set -e

echo "🚀 Starting CodeMentor AI Simplified Production Environment..."

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

# Clean up existing processes
cleanup_existing() {
    print_status "Cleaning up existing processes..."
    
    # Kill existing processes on our ports
    for port in 3000 3001; do
        if lsof -i :$port &> /dev/null; then
            print_warning "Killing process on port $port"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    print_success "Cleanup completed"
}

# Start infrastructure services
start_infrastructure() {
    print_status "Starting infrastructure services (PostgreSQL, Redis)..."
    
    # Start Docker services
    docker-compose up -d postgres redis
    
    # Wait for services to be ready
    print_status "Waiting for database to be ready..."
    timeout=60
    while ! docker exec codementor-postgres pg_isready -U postgres -d codementor_ai &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Database failed to start within 60 seconds"
            exit 1
        fi
    done
    
    print_status "Waiting for Redis to be ready..."
    timeout=30
    while ! docker exec codementor-redis redis-cli ping &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Redis failed to start within 30 seconds"
            exit 1
        fi
    done
    
    print_success "Infrastructure services are ready"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Run database migrations and seed
    cd server
    pnpm prisma generate
    pnpm prisma db push
    pnpm db:seed
    cd ..
    
    print_success "Database setup completed"
}

# Start application server
start_server() {
    print_status "Starting application server..."
    
    # Create logs directory
    mkdir -p logs
    
    # Start server using the primary entry point
    cd server
    pnpm dev > ../logs/server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > ../logs/server.pid
    cd ..
    
    # Wait for server to start
    print_status "Waiting for server to start..."
    timeout=30
    while ! curl -s http://localhost:3001/health &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Server failed to start within 30 seconds"
            print_error "Check logs/server.log for details"
            exit 1
        fi
    done
    
    print_success "Server started successfully"
}

# Start client application
start_client() {
    print_status "Starting client application..."

    cd client
    pnpm dev -- --port 3000 --host > ../logs/client.log 2>&1 &
    CLIENT_PID=$!
    echo $CLIENT_PID > ../logs/client.pid
    cd ..
    
    # Wait for client to start
    print_status "Waiting for client to start..."
    timeout=30
    while ! curl -s http://localhost:3000 &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Client failed to start within 30 seconds"
            print_error "Check logs/client.log for details"
            exit 1
        fi
    done
    
    print_success "Client started successfully"
}

# Display status and URLs
display_status() {
    echo ""
    echo "🎉 CodeMentor AI Simplified Production Environment is ready!"
    echo ""
    echo "📱 Application URLs:"
    echo "   Frontend:  http://localhost:3000"
    echo "   Backend:   http://localhost:3001"
    echo "   Health:    http://localhost:3001/health"
    echo ""
    echo "🗄️  Database Access:"
    echo "   PostgreSQL: localhost:5432"
    echo "   Redis:      localhost:6379"
    echo ""
    echo "👥 Test Accounts:"
    echo "   Admin:     admin@codementor-ai.com / admin123"
    echo "   Developer: developer@codementor-ai.com / developer123"
    echo "   Student:   student@codementor-ai.com / student123"
    echo ""
    echo "📊 Monitoring:"
    echo "   Server logs: tail -f logs/server.log"
    echo "   Client logs: tail -f logs/client.log"
    echo ""
    echo "🛑 To stop the environment:"
    echo "   ./scripts/stop-production-local.sh"
    echo ""
    echo "🔧 For UAT testing, see UAT_TESTING_GUIDE.md"
    echo ""
}

# Main execution
main() {
    echo "🚀 CodeMentor AI - Simplified Production Setup"
    echo "=========================================="
    
    cleanup_existing
    start_infrastructure
    setup_database
    start_server
    start_client
    display_status
    
    # Keep script running to show logs
    echo "Press Ctrl+C to stop monitoring logs..."
    trap 'echo ""; echo "Use ./scripts/stop-production-local.sh to stop all services"; exit 0' INT
    
    # Show live logs
    tail -f logs/server.log logs/client.log 2>/dev/null || sleep infinity
}

# Run main function
main "$@"