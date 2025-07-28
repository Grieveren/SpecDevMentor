#!/bin/bash

# Comprehensive Test Runner Script
set -e

echo "🚀 Starting Comprehensive Test Suite..."

# Parse command line arguments
TEST_SUITE=${1:-"all"}
UI_MODE=${2:-""}

echo "Test Suite: $TEST_SUITE"

# Check if required services are running
check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    echo "Checking $service_name on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi
        
        echo "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start within timeout"
    return 1
}

# Start services if not running
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "Starting server..."
    pnpm --filter server dev &
    SERVER_PID=$!
fi

if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "Starting client..."
    pnpm --filter client dev &
    CLIENT_PID=$!
fi

# Wait for services to be ready
check_service "Server" 3001
check_service "Client" 5173

# Run the tests based on suite selection
echo "🧪 Running tests for suite: $TEST_SUITE"

run_test_suite() {
    local suite=$1
    local ui_flag=$2
    
    case $suite in
        "smoke")
            echo "🔥 Running smoke tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:smoke --ui
            else
                pnpm test:smoke
            fi
            ;;
        "e2e")
            echo "🔄 Running end-to-end workflow tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:e2e:ui
            else
                pnpm test:e2e
            fi
            ;;
        "accessibility")
            echo "♿ Running accessibility tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:accessibility --ui
            else
                pnpm test:accessibility
            fi
            ;;
        "security")
            echo "🔒 Running security tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:security --ui
            else
                pnpm test:security
            fi
            ;;
        "performance")
            echo "⚡ Running performance tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:performance --ui
            else
                pnpm test:performance
            fi
            ;;
        "compliance")
            echo "📋 Running compliance tests..."
            if [ "$ui_flag" = "--ui" ]; then
                pnpm test:compliance --ui
            else
                pnpm test:compliance
            fi
            ;;
        "all")
            echo "🎯 Running all test suites..."
            run_test_suite "smoke" "$ui_flag"
            run_test_suite "e2e" "$ui_flag"
            run_test_suite "accessibility" "$ui_flag"
            run_test_suite "security" "$ui_flag"
            run_test_suite "performance" "$ui_flag"
            run_test_suite "compliance" "$ui_flag"
            ;;
        *)
            echo "❌ Unknown test suite: $suite"
            echo ""
            echo "Usage: $0 [TEST_SUITE] [UI_MODE]"
            echo ""
            echo "Available test suites:"
            echo "  smoke        - Quick validation tests"
            echo "  e2e          - End-to-end workflow tests"
            echo "  accessibility - Accessibility compliance tests"
            echo "  security     - Security and penetration tests"
            echo "  performance  - Performance and load tests"
            echo "  compliance   - Data privacy and compliance tests"
            echo "  all          - Run all test suites (default)"
            echo ""
            echo "UI Mode:"
            echo "  --ui         - Run tests with Playwright UI"
            echo ""
            echo "Examples:"
            echo "  $0 smoke"
            echo "  $0 accessibility --ui"
            echo "  $0 all"
            exit 1
            ;;
    esac
}

run_test_suite "$TEST_SUITE" "$UI_MODE"

TEST_EXIT_CODE=$?

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
fi

if [ ! -z "$CLIENT_PID" ]; then
    echo "Stopping client..."
    kill $CLIENT_PID 2>/dev/null || true
fi

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Test suite '$TEST_SUITE' completed successfully"
    echo "📊 Test results available in test-results/ directory"
else
    echo "❌ Test suite '$TEST_SUITE' failed"
    echo "📋 Check test-results/ directory for detailed reports"
fi

exit $TEST_EXIT_CODE