#!/bin/bash

# Authentication Error Validation Test Script
# Tests all error handling scenarios using curl

BASE_URL="http://localhost:3001"
REGISTER_ENDPOINT="${BASE_URL}/api/auth/register"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

test_endpoint() {
    local test_name="$1"
    local data="$2"
    local expected_status="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log $BLUE "\nTesting: $test_name"
    log $YELLOW "Data: $data"
    
    # Make the request and capture response
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$REGISTER_ENDPOINT" 2>/dev/null)
    
    # Extract status code (last line) and body (everything else)
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    log $YELLOW "Status: $status_code"
    log $YELLOW "Response: $response_body"
    
    # Check if status code matches expected
    if [ "$status_code" = "$expected_status" ]; then
        # Check if response contains error information
        if echo "$response_body" | grep -q '"success":false' && echo "$response_body" | grep -q '"message"'; then
            log $GREEN "✅ PASS - Correct error response"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log $RED "❌ FAIL - Missing proper error structure"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        log $RED "❌ FAIL - Expected status $expected_status, got $status_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Check server availability
log $CYAN "=== Testing Server Availability ==="
server_status=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/health" 2>/dev/null || echo "000")

if [ "$server_status" = "200" ] || [ "$server_status" = "404" ]; then
    log $GREEN "✅ Server is running"
else
    log $RED "❌ Server not available (status: $server_status)"
    log $YELLOW "Please start the server with: cd server && npm run dev"
    exit 1
fi

# Test 1: Missing all fields
log $CYAN "\n=== Testing Missing Required Fields ==="
test_endpoint "Missing all fields" '{}' "400"

# Test 2: Missing name
test_endpoint "Missing name" '{"email":"test@example.com","password":"ValidPass123!"}' "400"

# Test 3: Missing email
test_endpoint "Missing email" '{"name":"Test User","password":"ValidPass123!"}' "400"

# Test 4: Missing password
test_endpoint "Missing password" '{"name":"Test User","email":"test@example.com"}' "400"

# Test 5: Invalid email formats
log $CYAN "\n=== Testing Invalid Email Formats ==="
test_endpoint "Invalid email - no @" '{"name":"Test User","email":"invalid-email","password":"ValidPass123!"}' "400"

test_endpoint "Invalid email - no domain" '{"name":"Test User","email":"test@","password":"ValidPass123!"}' "400"

test_endpoint "Invalid email - no TLD" '{"name":"Test User","email":"test@domain","password":"ValidPass123!"}' "400"

test_endpoint "Empty email" '{"name":"Test User","email":"","password":"ValidPass123!"}' "400"

# Test 6: Weak passwords
log $CYAN "\n=== Testing Weak Passwords ==="
test_endpoint "Too short password" '{"name":"Test User","email":"test@example.com","password":"123"}' "400"

test_endpoint "No uppercase letter" '{"name":"Test User","email":"test@example.com","password":"weakpass123!"}' "400"

test_endpoint "No lowercase letter" '{"name":"Test User","email":"test@example.com","password":"WEAKPASS123!"}' "400"

test_endpoint "No number" '{"name":"Test User","email":"test@example.com","password":"WeakPass!"}' "400"

test_endpoint "No special character" '{"name":"Test User","email":"test@example.com","password":"WeakPass123"}' "400"

test_endpoint "Empty password" '{"name":"Test User","email":"test@example.com","password":""}' "400"

# Test 7: Valid registration (control test)
log $CYAN "\n=== Testing Valid Registration (Control Test) ==="
unique_email="test-$(date +%s)@example.com"
test_endpoint "Valid registration" "{\"name\":\"Test User\",\"email\":\"$unique_email\",\"password\":\"ValidPass123!\"}" "201"

# Final summary
log $CYAN "\n${'='*50}"
log $MAGENTA "📊 FINAL RESULTS"
log $CYAN "${'='*50}"
log $BLUE "Total Tests: $TOTAL_TESTS"
log $GREEN "Passed: $PASSED_TESTS"
if [ $FAILED_TESTS -eq 0 ]; then
    log $GREEN "Failed: $FAILED_TESTS"
else
    log $RED "Failed: $FAILED_TESTS"
fi

success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "N/A")
if [ $FAILED_TESTS -eq 0 ]; then
    log $GREEN "Success Rate: ${success_rate}%"
else
    log $YELLOW "Success Rate: ${success_rate}%"
fi

if [ $FAILED_TESTS -eq 0 ]; then
    log $GREEN "\n🎉 All authentication error validation tests passed!"
    exit 0
else
    log $RED "\n⚠️  Some tests failed. Please review the error handling implementation."
    exit 1
fi