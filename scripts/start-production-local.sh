#!/bin/bash

# CodeMentor AI - Local Production Environment Startup Script
set -e

echo "🚀 Starting CodeMentor AI Local Production Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm and try again."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker and try again."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Root .env file
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
        else
            print_warning ".env.example not found, creating basic .env file"
            cat > .env << EOF
NODE_ENV=production
DATABASE_URL="postgresql://codementor:password@localhost:5432/codementor_ai"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production-$(openssl rand -hex 32)"
REFRESH_SECRET="your-super-secret-refresh-key-change-in-production-$(openssl rand -hex 32)"
OPENAI_API_KEY="your-openai-api-key-here"
ENCRYPTION_SALT="$(openssl rand -hex 32)"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:3001"
EOF
        fi
    else
        print_success ".env file already exists"
    fi
    
    # Server .env file
    if [ ! -f server/.env ]; then
        if [ -f server/.env.example ]; then
            cp server/.env.example server/.env
            print_success "Created server/.env from server/.env.example"
        else
            print_warning "server/.env.example not found, creating basic server/.env file"
            cat > server/.env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://codementor:password@localhost:5432/codementor_ai"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production-$(openssl rand -hex 32)"
REFRESH_SECRET="your-super-secret-refresh-key-change-in-production-$(openssl rand -hex 32)"
OPENAI_API_KEY="your-openai-api-key-here"
ENCRYPTION_SALT="$(openssl rand -hex 32)"
CLIENT_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"
EOF
        fi
    else
        print_success "server/.env file already exists"
    fi
    
    # Production .env file
    if [ ! -f .env.production ]; then
        cp .env .env.production
        print_success "Created .env.production"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    pnpm install --frozen-lockfile
    
    print_success "Dependencies installed successfully"
}

# Clean up existing processes and containers
cleanup_existing() {
    print_status "Cleaning up existing processes and containers..."
    
    # Kill existing Node.js processes on ports 3000 and 3001
    if lsof -i :3000 &> /dev/null; then
        print_warning "Killing existing process on port 3000"
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    fi
    
    if lsof -i :3001 &> /dev/null; then
        print_warning "Killing existing process on port 3001"
        lsof -ti :3001 | xargs kill -9 2>/dev/null || true
    fi
    
    # Stop existing Docker containers
    docker-compose down 2>/dev/null || true
    
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
    while ! docker exec codementor-postgres pg_isready -U codementor -d codementor_ai &> /dev/null; do
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
    
    # Run database migrations
    cd server
    pnpm prisma generate
    pnpm prisma db push
    
    # Seed database with sample data
    if [ -f prisma/seed.ts ]; then
        print_status "Seeding database with sample data..."
        pnpm prisma db seed
    fi
    
    cd ..
    print_success "Database setup completed"
}

# Build applications
build_applications() {
    print_status "Building applications for production..."
    
    # Build server
    cd server
    pnpm build
    cd ..
    
    # Build client
    cd client
    pnpm build
    cd ..
    
    print_success "Applications built successfully"
}

# Start applications
start_applications() {
    print_status "Starting applications..."
    
    # Create logs directory
    mkdir -p logs
    
    # Start server in background
    cd server
    NODE_ENV=production pnpm start > ../logs/server.log 2>&1 &
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
    
    # Start client in background
    cd client
    NODE_ENV=production pnpm preview --port 3000 --host > ../logs/client.log 2>&1 &
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
    
    print_success "Applications started successfully"
}

# Display status and URLs
display_status() {
    echo ""
    echo "🎉 CodeMentor AI Local Production Environment is ready!"
    echo ""
    echo "📱 Application URLs:"
    echo "   Frontend:  http://localhost:3000"
    echo "   Backend:   http://localhost:3001"
    echo "   API Docs:  http://localhost:3001/api-docs"
    echo "   Health:    http://localhost:3001/health"
    echo ""
    echo "🗄️  Database Access:"
    echo "   PostgreSQL: localhost:5432"
    echo "   Redis:      localhost:6379"
    echo ""
    echo "📊 Monitoring:"
    echo "   Server logs: tail -f logs/server.log"
    echo "   Client logs: tail -f logs/client.log"
    echo ""
    echo "🛑 To stop the environment:"
    echo "   ./scripts/stop-production-local.sh"
    echo ""
    echo "🔧 For troubleshooting, see LOCAL_PRODUCTION_SETUP.md"
    echo ""
}

# Create stop script
create_stop_script() {
    cat > scripts/stop-production-local.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping CodeMentor AI Local Production Environment..."

# Kill application processes
if [ -f logs/server.pid ]; then
    SERVER_PID=$(cat logs/server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
        echo "✅ Server stopped"
    fi
    rm -f logs/server.pid
fi

if [ -f logs/client.pid ]; then
    CLIENT_PID=$(cat logs/client.pid)
    if kill -0 $CLIENT_PID 2>/dev/null; then
        kill $CLIENT_PID
        echo "✅ Client stopped"
    fi
    rm -f logs/client.pid
fi

# Stop Docker services
docker-compose down

echo "✅ All services stopped"
EOF
    chmod +x scripts/stop-production-local.sh
}

# Main execution
main() {
    echo "🚀 CodeMentor AI - Local Production Setup"
    echo "========================================"
    
    check_prerequisites
    setup_environment
    install_dependencies
    cleanup_existing
    start_infrastructure
    setup_database
    build_applications
    start_applications
    create_stop_script
    display_status
    
    # Keep script running to show logs
    echo "Press Ctrl+C to stop monitoring logs..."
    trap 'echo ""; echo "Use ./scripts/stop-production-local.sh to stop all services"; exit 0' INT
    
    # Show live logs
    tail -f logs/server.log logs/client.log 2>/dev/null || sleep infinity
}

# Run main function
main "$@"