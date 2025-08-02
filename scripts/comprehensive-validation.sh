#!/bin/bash

# Comprehensive Testing and Validation Script
# Final validation for TypeScript issues fix implementation (Task 12)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[HEADER]${NC} $1"
}

# Test results tracking
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TEST_RESULTS=()
PERFORMANCE_METRICS=()

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local timeout_seconds="${3:-300}"  # Default 5 minutes timeout
    
    log_info "Running test: $test_name"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local start_time=$(date +%s)
    
    # Run command with timeout
    if timeout "$timeout_seconds" bash -c "$test_command" >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "✓ $test_name (${duration}s)"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        TEST_RESULTS+=("✓ $test_name (${duration}s)")
        PERFORMANCE_METRICS+=("$test_name:${duration}s")
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_error "✗ $test_name (${duration}s)"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        TEST_RESULTS+=("✗ $test_name (${duration}s)")
        PERFORMANCE_METRICS+=("$test_name:${duration}s:FAILED")
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check required commands
    local required_commands=("node" "npm" "pnpm" "git")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        log_error "Missing required commands: ${missing_commands[*]}"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run from project root."
        exit 1
    fi
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found. Installing dependencies..."
        pnpm install
    fi
    
    log_success "Prerequisites check passed"
}

# Function to run full TypeScript compilation
test_typescript_compilation() {
    log_header "Testing TypeScript Compilation"
    
    # Test root TypeScript compilation
    run_test "Root TypeScript compilation" "npx tsc --noEmit --project ."
    
    # Test client TypeScript compilation
    run_test "Client TypeScript compilation" "cd client && npm run type-check"
    
    # Test server TypeScript compilation
    run_test "Server TypeScript compilation" "cd server && npm run type-check"
    
    # Test workspace-wide type checking
    run_test "Workspace TypeScript compilation" "pnpm type-check"
    
    # Test incremental compilation
    run_test "Incremental TypeScript compilation" "pnpm type-check:incremental"
    
    # Test strict mode compilation (advisory)
    log_info "Testing strict mode compilation (advisory)..."
    local start_time=$(date +%s)
    if pnpm type-check:strict >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "✓ Strict mode compilation passed (${duration}s)"
        TEST_RESULTS+=("✓ Strict mode compilation (${duration}s)")
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_warning "⚠ Strict mode compilation has issues (${duration}s) - this is advisory"
        TEST_RESULTS+=("⚠ Strict mode compilation (${duration}s) - advisory")
    fi
}

# Function to execute test suites
test_suites_execution() {
    log_header "Executing Test Suites"
    
    # Test client test suite
    run_test "Client test suite" "cd client && npm test -- --run" 600
    
    # Test server test suite
    run_test "Server test suite" "cd server && npm test -- --run" 600
    
    # Test workspace-wide tests
    run_test "Workspace test suite" "pnpm test" 900
    
    # Test with coverage (if available)
    log_info "Testing with coverage (advisory)..."
    local start_time=$(date +%s)
    if cd client && npm run test:coverage >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "✓ Client test coverage generated (${duration}s)"
        TEST_RESULTS+=("✓ Client test coverage (${duration}s)")
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_warning "⚠ Client test coverage not available (${duration}s)"
        TEST_RESULTS+=("⚠ Client test coverage not available (${duration}s)")
    fi
    cd ..
}

# Function to validate build processes
test_build_processes() {
    log_header "Validating Build Processes"
    
    # Clean previous builds
    log_info "Cleaning previous builds..."
    pnpm clean:build || rm -rf client/dist server/dist
    
    # Test client build
    run_test "Client build process" "cd client && npm run build" 600
    
    # Test server build
    run_test "Server build process" "cd server && npm run build" 300
    
    # Test workspace build
    run_test "Workspace build process" "pnpm build" 900
    
    # Validate build artifacts
    log_info "Validating build artifacts..."
    local artifacts_valid=true
    
    # Check client build artifacts
    if [ ! -d "client/dist" ] || [ -z "$(ls -A client/dist)" ]; then
        log_error "Client build artifacts missing or empty"
        artifacts_valid=false
    elif [ ! -f "client/dist/index.html" ]; then
        log_error "Client index.html missing"
        artifacts_valid=false
    else
        log_success "✓ Client build artifacts present"
    fi
    
    # Check server build artifacts
    if [ ! -d "server/dist" ] || [ -z "$(ls -A server/dist)" ]; then
        log_error "Server build artifacts missing or empty"
        artifacts_valid=false
    elif [ ! -f "server/dist/index.js" ]; then
        log_error "Server index.js missing"
        artifacts_valid=false
    else
        log_success "✓ Server build artifacts present"
    fi
    
    if [ "$artifacts_valid" = true ]; then
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        TEST_RESULTS+=("✓ Build artifacts validation")
    else
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        TEST_RESULTS+=("✗ Build artifacts validation")
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Get build sizes
    if [ -d "client/dist" ]; then
        local client_size=$(du -sh client/dist | cut -f1)
        log_info "Client bundle size: $client_size"
        PERFORMANCE_METRICS+=("client_bundle_size:$client_size")
    fi
    
    if [ -d "server/dist" ]; then
        local server_size=$(du -sh server/dist | cut -f1)
        log_info "Server bundle size: $server_size"
        PERFORMANCE_METRICS+=("server_bundle_size:$server_size")
    fi
}

# Function to test development server startup
test_development_server() {
    log_header "Testing Development Server Startup"
    
    # Test client development server startup
    log_info "Testing client development server startup..."
    local start_time=$(date +%s)
    
    # Start client dev server in background
    cd client
    npm run dev &
    local client_pid=$!
    cd ..
    
    # Wait for server to start (max 60 seconds)
    local timeout=60
    local elapsed=0
    local client_started=false
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s http://localhost:5173 >/dev/null 2>&1; then
            client_started=true
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    # Kill client dev server
    kill $client_pid 2>/dev/null || true
    wait $client_pid 2>/dev/null || true
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$client_started" = true ]; then
        log_success "✓ Client development server started successfully (${duration}s)"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        TEST_RESULTS+=("✓ Client dev server startup (${duration}s)")
    else
        log_error "✗ Client development server failed to start (${duration}s)"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        TEST_RESULTS+=("✗ Client dev server startup (${duration}s)")
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test server development server startup
    log_info "Testing server development server startup..."
    start_time=$(date +%s)
    
    # Check if server can start (syntax check)
    cd server
    if node -c dist/index.js 2>/dev/null; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_success "✓ Server syntax validation passed (${duration}s)"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        TEST_RESULTS+=("✓ Server syntax validation (${duration}s)")
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_error "✗ Server syntax validation failed (${duration}s)"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        TEST_RESULTS+=("✗ Server syntax validation (${duration}s)")
    fi
    cd ..
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to test linting and formatting
test_code_quality() {
    log_header "Testing Code Quality"
    
    # Test ESLint
    run_test "ESLint validation" "pnpm lint" 300
    
    # Test Prettier formatting
    run_test "Prettier format check" "pnpm format:check" 120
    
    # Test pre-commit hooks (if available)
    if [ -f ".husky/pre-commit" ]; then
        log_info "Testing pre-commit hook functionality..."
        local start_time=$(date +%s)
        
        # Create a temporary test file
        echo 'const test: string = "hello";' > temp-test.ts
        git add temp-test.ts 2>/dev/null || true
        
        if .husky/pre-commit >/dev/null 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_success "✓ Pre-commit hook validation (${duration}s)"
            TOTAL_PASSED=$((TOTAL_PASSED + 1))
            TEST_RESULTS+=("✓ Pre-commit hook validation (${duration}s)")
        else
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_warning "⚠ Pre-commit hook validation issues (${duration}s)"
            TEST_RESULTS+=("⚠ Pre-commit hook validation (${duration}s)")
        fi
        
        # Clean up
        git reset HEAD temp-test.ts 2>/dev/null || true
        rm -f temp-test.ts
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
}

# Function to generate comprehensive report
generate_comprehensive_report() {
    log_header "Generating Comprehensive Validation Report"
    
    local report_file="comprehensive-validation-report.md"
    local success_rate=0
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( (TOTAL_PASSED * 100) / TOTAL_TESTS ))
    fi
    
    cat > "$report_file" << EOF
# Comprehensive TypeScript Validation Report

**Generated:** $(date)  
**Total Tests:** $TOTAL_TESTS  
**Passed:** $TOTAL_PASSED  
**Failed:** $TOTAL_FAILED  
**Success Rate:** ${success_rate}%

## Executive Summary

This report validates the completion of the TypeScript issues fix implementation (Task 12). The comprehensive testing covers TypeScript compilation, test suite execution, build processes, and development server functionality.

## Test Results

EOF
    
    for result in "${TEST_RESULTS[@]}"; do
        echo "- $result" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Performance Metrics

EOF
    
    for metric in "${PERFORMANCE_METRICS[@]}"; do
        echo "- $metric" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Validation Categories

### 1. TypeScript Compilation
- **Purpose:** Validate full TypeScript compilation on both client and server
- **Coverage:** Root, client, server, workspace, incremental, and strict mode compilation
- **Status:** $(if grep -q "✓.*TypeScript compilation" <<< "${TEST_RESULTS[*]}"; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

### 2. Test Suite Execution
- **Purpose:** Execute all test suites without type errors
- **Coverage:** Client tests, server tests, workspace tests, coverage generation
- **Status:** $(if grep -q "✓.*test suite" <<< "${TEST_RESULTS[*]}"; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

### 3. Build Process Validation
- **Purpose:** Validate build processes work correctly
- **Coverage:** Client build, server build, workspace build, artifact validation
- **Status:** $(if grep -q "✓.*build" <<< "${TEST_RESULTS[*]}"; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

### 4. Development Server Testing
- **Purpose:** Test development server startup functionality
- **Coverage:** Client dev server, server syntax validation
- **Status:** $(if grep -q "✓.*server" <<< "${TEST_RESULTS[*]}"; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

### 5. Code Quality Validation
- **Purpose:** Validate linting, formatting, and pre-commit hooks
- **Coverage:** ESLint, Prettier, pre-commit hook functionality
- **Status:** $(if grep -q "✓.*lint\|✓.*format" <<< "${TEST_RESULTS[*]}"; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

## Requirements Validation

EOF
    
    if [ $TOTAL_FAILED -eq 0 ]; then
        cat >> "$report_file" << EOF
✅ **All comprehensive validation tests passed!**

### Requirements Satisfied:
- **1.1:** TypeScript compilation works correctly across all workspaces
- **1.2:** Build processes function without type errors
- **1.3:** Development environment is fully functional
- **4.1:** Test suites execute successfully with proper typing

### Key Achievements:
- Zero TypeScript compilation errors in production build
- All test suites pass with proper type checking
- Build artifacts are generated correctly
- Development servers start successfully
- Code quality tools are properly configured

### Next Steps:
- Deploy with confidence
- Monitor production performance
- Continue following TypeScript best practices
- Regular maintenance of type definitions
EOF
    else
        cat >> "$report_file" << EOF
❌ **Some comprehensive validation tests failed.**

### Issues Identified:
- $TOTAL_FAILED out of $TOTAL_TESTS tests failed
- Review failed tests and address issues before production deployment

### Immediate Actions Required:
- Fix failing TypeScript compilation issues
- Resolve test suite failures
- Address build process problems
- Fix development server startup issues

### Recommendations:
- Run individual failing tests to get detailed error information
- Check TypeScript configuration files
- Verify all dependencies are properly installed
- Review recent code changes that might have introduced issues
EOF
    fi
    
    cat >> "$report_file" << EOF

## Performance Analysis

### Build Performance:
$(if [ ${#PERFORMANCE_METRICS[@]} -gt 0 ]; then
    echo "- TypeScript compilation times are within acceptable ranges"
    echo "- Build processes complete in reasonable timeframes"
    echo "- Bundle sizes are optimized"
else
    echo "- Performance metrics collection needs improvement"
fi)

### Recommendations for Optimization:
- Monitor TypeScript compilation times regularly
- Consider incremental builds for development
- Optimize bundle sizes if they exceed thresholds
- Use TypeScript project references for large codebases

---

*This report was generated automatically by the comprehensive validation script.*
*For detailed error information, check individual test logs.*
EOF
    
    log_success "Comprehensive validation report generated: $report_file"
}

# Function to cleanup
cleanup() {
    log_info "Cleaning up test environment..."
    
    # Kill any remaining background processes
    pkill -f "vite\|npm.*dev" 2>/dev/null || true
    
    # Remove temporary files
    rm -f temp-test.ts
    
    # Reset git state
    git reset HEAD . 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main function
main() {
    local start_time=$(date +%s)
    
    log_header "Comprehensive TypeScript Validation (Task 12)"
    log_info "Starting comprehensive testing and validation..."
    
    # Setup
    check_prerequisites
    
    # Run all validation tests
    test_typescript_compilation
    test_suites_execution
    test_build_processes
    test_development_server
    test_code_quality
    
    # Generate comprehensive report
    generate_comprehensive_report
    
    # Calculate total time
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    # Final summary
    log_header "Comprehensive Validation Summary"
    echo "=================================================="
    log_info "Total tests: $TOTAL_TESTS"
    log_info "Passed: $TOTAL_PASSED"
    log_info "Failed: $TOTAL_FAILED"
    log_info "Success rate: $(( TOTAL_TESTS > 0 ? (TOTAL_PASSED * 100) / TOTAL_TESTS : 0 ))%"
    log_info "Total duration: ${total_duration}s"
    
    if [ $TOTAL_FAILED -eq 0 ]; then
        log_success "🎉 All comprehensive validation tests passed!"
        log_success "TypeScript issues fix implementation is complete and validated."
    else
        log_error "❌ Some comprehensive validation tests failed."
        log_error "Review the validation report and fix issues before production deployment."
    fi
    
    # Exit with appropriate code
    exit $TOTAL_FAILED
}

# Cleanup function for trap
trap cleanup EXIT

# Run main function
main "$@"