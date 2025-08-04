#!/bin/bash

# Build validation script with timeout protection and error handling
# This script validates each phase of the build pipeline

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT_SECONDS=300  # 5 minutes timeout per command
LOG_DIR="logs/build-validation"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/build_validation_$TIMESTAMP.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "info")
            echo -e "${YELLOW}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "success")
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "error")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Function to run command with timeout
run_with_timeout() {
    local cmd=$1
    local phase=$2
    local timeout=${3:-$TIMEOUT_SECONDS}
    
    print_status "info" "Running $phase..."
    echo "Command: $cmd" >> "$LOG_FILE"
    
    # Run command with timeout
    if timeout "$timeout" bash -c "$cmd" >> "$LOG_FILE" 2>&1; then
        print_status "success" "$phase completed successfully"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_status "error" "$phase timed out after $timeout seconds"
        else
            print_status "error" "$phase failed with exit code $exit_code"
        fi
        return $exit_code
    fi
}

# Function to check if process is running
check_process() {
    local process_name=$1
    if pgrep -f "$process_name" > /dev/null; then
        print_status "error" "Process '$process_name' is still running. Please stop it before running build validation."
        return 1
    fi
    return 0
}

# Function to clean build artifacts
clean_build() {
    print_status "info" "Cleaning build artifacts..."
    run_with_timeout "pnpm clean:build" "Clean build artifacts" 60
}

# Main validation pipeline
main() {
    print_status "info" "Starting build validation pipeline..."
    print_status "info" "Log file: $LOG_FILE"
    
    # Check for running processes that might interfere
    if ! check_process "vite" || ! check_process "tsx watch"; then
        print_status "error" "Please stop all development servers before running build validation"
        exit 1
    fi
    
    # Phase 1: Clean previous build artifacts
    if ! clean_build; then
        print_status "error" "Failed to clean build artifacts"
        exit 1
    fi
    
    # Phase 2: Install dependencies
    if ! run_with_timeout "pnpm install --frozen-lockfile" "Install dependencies" 180; then
        print_status "error" "Failed to install dependencies"
        exit 1
    fi
    
    # Phase 3: Type checking
    if ! run_with_timeout "pnpm type-check" "TypeScript type checking" 120; then
        print_status "error" "TypeScript type checking failed"
        exit 1
    fi
    
    # Phase 4: Linting
    if ! run_with_timeout "pnpm lint" "ESLint checking" 120; then
        print_status "error" "Linting failed"
        exit 1
    fi
    
    # Phase 5: Unit tests
    if ! run_with_timeout "pnpm test" "Unit tests" 180; then
        print_status "error" "Unit tests failed"
        exit 1
    fi
    
    # Phase 6: Build client
    if ! run_with_timeout "pnpm --filter client build:only" "Build client" 180; then
        print_status "error" "Client build failed"
        exit 1
    fi
    
    # Phase 7: Build server
    if ! run_with_timeout "pnpm --filter server build" "Build server" 120; then
        print_status "error" "Server build failed"
        exit 1
    fi
    
    # Phase 8: Validate build outputs
    print_status "info" "Validating build outputs..."
    
    # Validate client artifacts
    if [ ! -f "client/dist/index.html" ] || [ ! -d "client/dist/assets" ]; then
        print_status "error" "Client artifacts validation failed"
        exit 1
    else
        CLIENT_SIZE=$(du -sh client/dist | cut -f1)
        print_status "success" "Client artifacts generated (${CLIENT_SIZE})"
    fi
    
    # Validate server artifacts
    if [ ! -f "server/dist/index.js" ] || [ ! -d "server/dist/routes" ]; then
        print_status "error" "Server artifacts validation failed"
        exit 1
    else
        SERVER_SIZE=$(du -sh server/dist | cut -f1)
        print_status "success" "Server artifacts generated (${SERVER_SIZE})"
    fi
    
    # Validate shared artifacts
    if [ ! -d "shared/dist/types" ]; then
        print_status "error" "Shared artifacts validation failed"
        exit 1
    else
        SHARED_SIZE=$(du -sh shared/dist | cut -f1)
        print_status "success" "Shared artifacts generated (${SHARED_SIZE})"
    fi
    
    # Phase 9: Smoke tests
    print_status "info" "Running smoke tests..."
    
    # Test server startup
    cd server
    timeout 10 node dist/index.js &
    SERVER_PID=$!
    sleep 3
    
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        print_status "success" "Server starts successfully"
        
        # Test health endpoint
        if curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
            print_status "success" "Health endpoint responding"
        else
            print_status "error" "Health endpoint not responding"
        fi
        
        kill $SERVER_PID 2>/dev/null || true
    else
        print_status "error" "Server failed to start"
    fi
    cd ..
    
    # Phase 10: Performance benchmarks
    print_status "info" "Running performance benchmarks..."
    
    # Check client bundle sizes
    CLIENT_JS_SIZE=$(find client/dist/assets -name "*.js" -exec du -ch {} + 2>/dev/null | grep total$ | cut -f1 || echo "0")
    print_status "info" "Client JavaScript bundle size: ${CLIENT_JS_SIZE}"
    
    # Check if bundle size is acceptable (warn if over 2MB)
    if [[ "${CLIENT_JS_SIZE}" =~ ^[0-9]+(\.?[0-9]+)?M$ ]]; then
        SIZE_NUM=$(echo "${CLIENT_JS_SIZE}" | sed 's/M$//')
        if (( $(echo "$SIZE_NUM > 2" | bc -l 2>/dev/null || echo 0) )); then
            print_status "error" "Client bundle size too large (${CLIENT_JS_SIZE})"
        fi
    fi
    
    # Summary
    print_status "success" "Build validation completed successfully!"
    print_status "info" "Full log available at: $LOG_FILE"
    
    # Generate summary report
    generate_summary_report
}

# Function to generate summary report
generate_summary_report() {
    local report_file="$LOG_DIR/build_validation_summary_$TIMESTAMP.txt"
    
    cat > "$report_file" << EOF
Build Validation Summary
========================
Date: $(date)
Status: SUCCESS

Phase Results:
--------------
1. Clean build artifacts: PASSED
2. Install dependencies: PASSED
3. TypeScript type checking: PASSED
4. ESLint checking: PASSED
5. Unit tests: PASSED
6. Build client: PASSED
7. Build server: PASSED
8. Validate outputs: PASSED

Build Sizes:
------------
Client: $CLIENT_SIZE
Server: $SERVER_SIZE
Shared: $SHARED_SIZE

Log file: $LOG_FILE
EOF
    
    print_status "info" "Summary report generated: $report_file"
}

# Error handler
error_handler() {
    local line_no=$1
    print_status "error" "Build validation failed at line $line_no"
    print_status "info" "Check log file for details: $LOG_FILE"
    exit 1
}

# Set error trap
trap 'error_handler $LINENO' ERR

# Run main function
main "$@"
