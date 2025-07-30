#!/bin/bash

# CodeMentor AI - UAT Testing Script
set -e

echo "🧪 Running CodeMentor AI UAT Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    print_test "$test_name"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if result=$(eval "$test_command" 2>&1); then
        if [[ -z "$expected_pattern" ]] || echo "$result" | grep -q "$expected_pattern"; then
            print_pass "$test_name"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_fail "$test_name - Expected pattern not found"
            echo "Result: $result"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        print_fail "$test_name - Command failed"
        echo "Error: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

echo "🚀 CodeMentor AI - Comprehensive UAT Testing"
echo "============================================"
echo ""

# Test 1: Health Check
run_test "API Health Check" \
    "curl -s http://localhost:3001/health" \
    "healthy"

# Test 2: Database Connectivity
run_test "Database Connectivity" \
    "curl -s http://localhost:3001/api/users" \
    "success"

# Test 3: User Authentication - Success
run_test "User Authentication (Success)" \
    "curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@codementor-ai.com\",\"password\":\"admin123\"}'" \
    "success"

# Test 4: User Authentication - Failure
run_test "User Authentication (Failure)" \
    "curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@codementor-ai.com\",\"password\":\"wrong\"}'" \
    "Invalid credentials"

# Test 5: Projects API
run_test "Projects API" \
    "curl -s http://localhost:3001/api/projects" \
    "success"

# Test 6: Frontend Accessibility
run_test "Frontend Accessibility" \
    "curl -s -I http://localhost:3002" \
    "200 OK"

# Test 7: Database Direct Connection
run_test "Database Direct Connection" \
    "docker exec codementor-postgres pg_isready -U postgres -d codementor_ai" \
    "accepting connections"

# Test 8: Redis Connection
run_test "Redis Connection" \
    "docker exec codementor-redis redis-cli ping" \
    "PONG"

# Test 9: User Count Verification
run_test "User Count Verification" \
    "docker exec codementor-postgres psql -U postgres -d codementor_ai -t -c 'SELECT COUNT(*) FROM users;'" \
    "4"

# Test 10: Project Count Verification
run_test "Project Count Verification" \
    "docker exec codementor-postgres psql -U postgres -d codementor_ai -t -c 'SELECT COUNT(*) FROM specification_projects;'" \
    "1"

echo "📊 UAT Test Results Summary"
echo "=========================="
echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    print_pass "🎉 All UAT tests passed! System is ready for comprehensive testing."
    echo ""
    echo "🌐 Access Points:"
    echo "   Frontend: http://localhost:3002"
    echo "   Backend:  http://localhost:3001"
    echo "   Health:   http://localhost:3001/health"
    echo ""
    echo "👥 Test Accounts:"
    echo "   admin@codementor-ai.com / admin123"
    echo "   developer@codementor-ai.com / developer123"
    echo "   teamlead@codementor-ai.com / teamlead123"
    echo "   student@codementor-ai.com / student123"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Open http://localhost:3002 in your browser"
    echo "   2. Test the React application functionality"
    echo "   3. Follow COMPREHENSIVE_UAT_STRATEGY.md for detailed testing"
    echo ""
else
    print_fail "❌ Some tests failed. Please check the issues above."
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check if all services are running"
    echo "   - Verify database and Redis containers are up"
    echo "   - Check logs/server.log for backend issues"
    echo ""
fi

echo "📖 For detailed UAT testing, see:"
echo "   - COMPREHENSIVE_UAT_STRATEGY.md"
echo "   - UAT_TESTING_GUIDE.md"
echo ""