#!/bin/bash

# CodeMentor AI Deployment Script
set -e

# Configuration
NAMESPACE="codementor-ai"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-codementor-ai}"
VERSION="${VERSION:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build server image
    log_info "Building server image..."
    docker build -t ${DOCKER_REGISTRY}/server:${VERSION} -f server/Dockerfile .
    
    # Build client image
    log_info "Building client image..."
    docker build -t ${DOCKER_REGISTRY}/client:${VERSION} -f client/Dockerfile .
    
    log_info "Docker images built successfully"
}

# Push Docker images
push_images() {
    log_info "Pushing Docker images to registry..."
    
    docker push ${DOCKER_REGISTRY}/server:${VERSION}
    docker push ${DOCKER_REGISTRY}/client:${VERSION}
    
    log_info "Docker images pushed successfully"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
}

# Deploy secrets (with validation)
deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets file has been configured
    if grep -q "REPLACE_WITH" k8s/secrets.yaml; then
        log_error "Secrets file contains placeholder values. Please configure k8s/secrets.yaml with actual values."
        exit 1
    fi
    
    kubectl apply -f k8s/secrets.yaml
    log_info "Secrets deployed successfully"
}

# Deploy configuration
deploy_config() {
    log_info "Deploying configuration..."
    kubectl apply -f k8s/configmap.yaml
}

# Deploy database
deploy_database() {
    log_info "Deploying PostgreSQL..."
    kubectl apply -f k8s/postgres-deployment.yaml
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=300s
    
    log_info "PostgreSQL deployed successfully"
}

# Deploy Redis
deploy_redis() {
    log_info "Deploying Redis..."
    kubectl apply -f k8s/redis-deployment.yaml
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=300s
    
    log_info "Redis deployed successfully"
}

# Deploy server
deploy_server() {
    log_info "Deploying server application..."
    
    # Update image tag in deployment
    sed -i.bak "s|codementor-ai/server:latest|${DOCKER_REGISTRY}/server:${VERSION}|g" k8s/server-deployment.yaml
    
    kubectl apply -f k8s/server-deployment.yaml
    
    # Restore original file
    mv k8s/server-deployment.yaml.bak k8s/server-deployment.yaml
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    kubectl wait --for=condition=ready pod -l app=codementor-server -n ${NAMESPACE} --timeout=300s
    
    log_info "Server deployed successfully"
}

# Deploy client
deploy_client() {
    log_info "Deploying client application..."
    
    # Update image tag in deployment
    sed -i.bak "s|codementor-ai/client:latest|${DOCKER_REGISTRY}/client:${VERSION}|g" k8s/client-deployment.yaml
    
    kubectl apply -f k8s/client-deployment.yaml
    
    # Restore original file
    mv k8s/client-deployment.yaml.bak k8s/client-deployment.yaml
    
    # Wait for client to be ready
    log_info "Waiting for client to be ready..."
    kubectl wait --for=condition=ready pod -l app=codementor-client -n ${NAMESPACE} --timeout=300s
    
    log_info "Client deployed successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Get a server pod name
    SERVER_POD=$(kubectl get pods -n ${NAMESPACE} -l app=codementor-server -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$SERVER_POD" ]; then
        log_error "No server pods found"
        exit 1
    fi
    
    # Run migrations
    kubectl exec -n ${NAMESPACE} ${SERVER_POD} -- npm run db:migrate:prod
    
    log_info "Database migrations completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check all pods are running
    kubectl get pods -n ${NAMESPACE}
    
    # Check services
    kubectl get services -n ${NAMESPACE}
    
    # Check ingress
    kubectl get ingress -n ${NAMESPACE}
    
    # Test health endpoints
    log_info "Testing health endpoints..."
    
    # Port forward to test locally
    kubectl port-forward -n ${NAMESPACE} service/codementor-server-service 8080:3001 &
    PF_PID=$!
    
    sleep 5
    
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_info "Server health check passed"
    else
        log_error "Server health check failed"
        kill $PF_PID
        exit 1
    fi
    
    kill $PF_PID
    
    log_info "Deployment verification completed successfully"
}

# Rollback function
rollback() {
    log_warn "Rolling back deployment..."
    
    # Rollback server
    kubectl rollout undo deployment/codementor-server -n ${NAMESPACE}
    
    # Rollback client
    kubectl rollout undo deployment/codementor-client -n ${NAMESPACE}
    
    log_info "Rollback completed"
}

# Main deployment function
deploy() {
    log_info "Starting CodeMentor AI deployment..."
    
    check_prerequisites
    build_images
    
    if [ "$SKIP_PUSH" != "true" ]; then
        push_images
    fi
    
    create_namespace
    deploy_secrets
    deploy_config
    deploy_database
    deploy_redis
    deploy_server
    deploy_client
    run_migrations
    verify_deployment
    
    log_info "Deployment completed successfully!"
    log_info "Application should be available at: https://codementor-ai.com"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "build")
        check_prerequisites
        build_images
        ;;
    "verify")
        verify_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|build|verify}"
        exit 1
        ;;
esac