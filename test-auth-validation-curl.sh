#!/bin/bash

# Comprehensive Authentication Validation Test using curl
# Tests all error handling and validation scenarios

BASE_URL="http://localhost:3001/api/auth"
PASSED=0
FAILED=0
TOTAL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test result tracking
log_test() {
    local test_name="$1"
    local passed="$2"
    local details="$3"
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$passed" = "true" ]; then
        PASSED=$((PASSED + 1))
        echo -e "${GREEN}✅ $test_name${NC}"
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}❌ $test_name${NC}"
        if [ -n "$details" ]; then
            echo -e "   ${details}"
        fi
    fi
}

# Make HTTP request with curl
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    
    local url="${BASE_URL}${endpoint}"
    local response_file=$(mktemp)
    local status_code
    
    if [ "$method" = "POST" ]; then
        status_code=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url" \
            -o "$response_file")
    else
        status_code=$(curl -s -w "%{http_code}" -X "$method" \
            "$url" \
            -o "$response_file")
    fi
    
    local response_body=$(cat "$response_file")
    rm "$response_file"
    
    # Return status code and response body
    echo "$status_code|$response_body"
}

# Check if server is running
check_server() {
    echo -e "${BLUE}🔍 Checking server availability...${NC}"
    
    local result=$(make_request "GET" "/../health" "" "")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    
    if [ "$status_code" = "000" ]; then
        echo -e "${RED}❌ Server is not running. Please start the development server first.${NC}"
        echo -e "   Run: cd server && npm run dev"
        exit 1
    fi
    
    log_test "Server availability" "true" "Server is responding (status: $status_code)"
}

# Test missing required fields
test_missing_fields() {
    echo -e "\n${BLUE}🧪 Testing registration with missing required fields...${NC}"
    
    # Missing email
    local result=$(make_request "POST" "/register" '{"password":"ValidPass123!","name":"Test User"}' "400")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    local response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "email"; then
        log_test "Missing email field validation" "true"
    else
        log_test "Missing email field validation" "false" "Expected 400 with email validation error, got: $status_code - $response"
    fi
    
    # Missing password
    result=$(make_request "POST" "/register" '{"email":"test@example.com","name":"Test User"}' "400")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "password"; then
        log_test "Missing password field validation" "true"
    else
        log_test "Missing password field validation" "false" "Expected 400 with password validation error, got: $status_code - $response"
    fi
    
    # Missing name
    result=$(make_request "POST" "/register" '{"email":"test@example.com","password":"ValidPass123!"}' "400")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "name"; then
        log_test "Missing name field validation" "true"
    else
        log_test "Missing name field validation" "false" "Expected 400 with name validation error, got: $status_code - $response"
    fi
    
    # Empty body
    result=$(make_request "POST" "/register" '{}' "400")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR"; then
        log_test "Empty request body validation" "true"
    else
        log_test "Empty request body validation" "false" "Expected 400 with validation errors, got: $status_code - $response"
    fi
}

# Test invalid email formats
test_invalid_emails() {
    echo -e "\n${BLUE}🧪 Testing registration with invalid email formats...${NC}"
    
    local invalid_emails=(
        "invalid-email"
        "invalid@"
        "@invalid.com"
        "invalid@.com"
        "invalid.com"
        "invalid@com"
        "invalid..email@test.com"
        "invalid@test..com"
    )
    
    for email in "${invalid_emails[@]}"; do
        local result=$(make_request "POST" "/register" "{\"email\":\"$email\",\"password\":\"ValidPass123!\",\"name\":\"Test User\"}" "400")
        local status_code=$(echo "$result" | cut -d'|' -f1)
        local response=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "email"; then
            log_test "Invalid email format: $email" "true"
        else
            log_test "Invalid email format: $email" "false" "Expected email validation error, got: $status_code - $response"
        fi
        
        sleep 0.1
    done
}

# Test weak passwords
test_weak_passwords() {
    echo -e "\n${BLUE}🧪 Testing registration with weak passwords...${NC}"
    
    local weak_passwords=(
        "short"
        "password"
        "PASSWORD"
        "12345678"
        "Password"
        "Password123"
        "Password!"
        "password123!"
        "PASSWORD123!"
        "Pass!1"
    )
    
    for password in "${weak_passwords[@]}"; do
        local result=$(make_request "POST" "/register" "{\"email\":\"test@example.com\",\"password\":\"$password\",\"name\":\"Test User\"}" "400")
        local status_code=$(echo "$result" | cut -d'|' -f1)
        local response=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "password"; then
            log_test "Weak password: $password" "true"
        else
            log_test "Weak password: $password" "false" "Expected password validation error, got: $status_code - $response"
        fi
        
        sleep 0.1
    done
}

# Test invalid names
test_invalid_names() {
    echo -e "\n${BLUE}🧪 Testing registration with invalid name formats...${NC}"
    
    # Name too short
    local result=$(make_request "POST" "/register" '{"email":"test@example.com","password":"ValidPass123!","name":"A"}' "400")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    local response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "name"; then
        log_test "Name too short validation" "true"
    else
        log_test "Name too short validation" "false" "Expected name validation error, got: $status_code - $response"
    fi
    
    # Name too long
    local long_name=$(printf 'A%.0s' {1..51})
    result=$(make_request "POST" "/register" "{\"email\":\"test@example.com\",\"password\":\"ValidPass123!\",\"name\":\"$long_name\"}" "400")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "name"; then
        log_test "Name too long validation" "true"
    else
        log_test "Name too long validation" "false" "Expected name validation error, got: $status_code - $response"
    fi
}

# Test duplicate email registration
test_duplicate_email() {
    echo -e "\n${BLUE}🧪 Testing duplicate email registration...${NC}"
    
    local test_email="test-duplicate-$(date +%s)@example.com"
    
    # First registration
    local result=$(make_request "POST" "/register" "{\"email\":\"$test_email\",\"password\":\"ValidPass123!\",\"name\":\"First User\"}" "")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    local response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "201" ] && echo "$response" | grep -q "success.*true"; then
        log_test "First registration with unique email" "true"
        
        # Second registration with same email
        result=$(make_request "POST" "/register" "{\"email\":\"$test_email\",\"password\":\"ValidPass123!\",\"name\":\"Second User\"}" "400")
        status_code=$(echo "$result" | cut -d'|' -f1)
        response=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "400" ] && (echo "$response" | grep -q "USER_EXISTS" || echo "$response" | grep -q "CONFLICT" || echo "$response" | grep -qi "exists"); then
            log_test "Duplicate email registration prevention" "true"
        else
            log_test "Duplicate email registration prevention" "false" "Expected conflict error, got: $status_code - $response"
        fi
    else
        log_test "First registration with unique email" "false" "Expected successful registration, got: $status_code - $response"
        log_test "Duplicate email registration prevention" "false" "Cannot test duplicate - first registration failed"
    fi
}

# Test login validation
test_login_validation() {
    echo -e "\n${BLUE}🧪 Testing login validation...${NC}"
    
    # Missing email
    local result=$(make_request "POST" "/login" '{"password":"ValidPass123!"}' "400")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    local response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR"; then
        log_test "Login missing email validation" "true"
    else
        log_test "Login missing email validation" "false" "Expected validation error, got: $status_code - $response"
    fi
    
    # Missing password
    result=$(make_request "POST" "/login" '{"email":"test@example.com"}' "400")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "VALIDATION_ERROR"; then
        log_test "Login missing password validation" "true"
    else
        log_test "Login missing password validation" "false" "Expected validation error, got: $status_code - $response"
    fi
    
    # Invalid credentials
    result=$(make_request "POST" "/login" '{"email":"nonexistent@example.com","password":"WrongPassword123!"}' "401")
    status_code=$(echo "$result" | cut -d'|' -f1)
    response=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "401" ] && echo "$response" | grep -q "INVALID_CREDENTIALS"; then
        log_test "Login invalid credentials" "true"
    else
        log_test "Login invalid credentials" "false" "Expected invalid credentials error, got: $status_code - $response"
    fi
}

# Test error message format
test_error_format() {
    echo -e "\n${BLUE}🧪 Testing error message format consistency...${NC}"
    
    local result=$(make_request "POST" "/register" '{"email":"invalid-email","password":"weak","name":"A"}' "400")
    local status_code=$(echo "$result" | cut -d'|' -f1)
    local response=$(echo "$result" | cut -d'|' -f2)
    
    # Check basic error structure
    if [ "$status_code" = "400" ] && echo "$response" | grep -q "success.*false" && echo "$response" | grep -q "VALIDATION_ERROR" && echo "$response" | grep -q "details"; then
        log_test "Error response structure" "true"
    else
        log_test "Error response structure" "false" "Invalid error structure: $response"
    fi
    
    # Check that response contains field-specific errors
    if echo "$response" | grep -q "field" && echo "$response" | grep -q "message"; then
        log_test "Error details format" "true"
    else
        log_test "Error details format" "false" "Missing field/message in error details: $response"
    fi
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting comprehensive authentication validation tests...${NC}"
    echo -e "${YELLOW}📍 Testing against: $BASE_URL${NC}"
    
    check_server
    test_missing_fields
    test_invalid_emails
    test_weak_passwords
    test_invalid_names
    test_duplicate_email
    test_login_validation
    test_error_format
    
    # Print summary
    echo -e "\n${YELLOW}📊 Test Results Summary:${NC}"
    echo -e "${GREEN}✅ Passed: $PASSED${NC}"
    echo -e "${RED}❌ Failed: $FAILED${NC}"
    echo -e "${BLUE}📈 Total: $TOTAL${NC}"
    
    if [ $TOTAL -gt 0 ]; then
        local success_rate=$(( (PASSED * 100) / TOTAL ))
        echo -e "${BLUE}🎯 Success Rate: ${success_rate}%${NC}"
    fi
    
    if [ $FAILED -gt 0 ]; then
        echo -e "\n${RED}Some tests failed. Check the output above for details.${NC}"
        exit 1
    else
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        exit 0
    fi
}

# Run the tests
main