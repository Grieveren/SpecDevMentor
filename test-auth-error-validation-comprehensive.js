#!/usr/bin/env node

/**
 * Comprehensive Authentication Error Validation Test
 * Tests all error handling scenarios for the authentication system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const REGISTER_ENDPOINT = `${BASE_URL}/api/auth/register`;

// Test configuration
const TEST_CASES = {
  missingFields: [
    {
      name: 'Missing all fields',
      data: {},
      expectedErrors: ['name', 'email', 'password'],
    },
    {
      name: 'Missing name',
      data: { email: 'test@example.com', password: 'ValidPass123!' },
      expectedErrors: ['name'],
    },
    {
      name: 'Missing email',
      data: { name: 'Test User', password: 'ValidPass123!' },
      expectedErrors: ['email'],
    },
    {
      name: 'Missing password',
      data: { name: 'Test User', email: 'test@example.com' },
      expectedErrors: ['password'],
    },
  ],
  invalidEmail: [
    {
      name: 'Invalid email format - no @',
      data: { name: 'Test User', email: 'invalid-email', password: 'ValidPass123!' },
      expectedError: 'email',
    },
    {
      name: 'Invalid email format - no domain',
      data: { name: 'Test User', email: 'test@', password: 'ValidPass123!' },
      expectedError: 'email',
    },
    {
      name: 'Invalid email format - no TLD',
      data: { name: 'Test User', email: 'test@domain', password: 'ValidPass123!' },
      expectedError: 'email',
    },
    {
      name: 'Empty email',
      data: { name: 'Test User', email: '', password: 'ValidPass123!' },
      expectedError: 'email',
    },
  ],
  weakPassword: [
    {
      name: 'Too short password',
      data: { name: 'Test User', email: 'test@example.com', password: '123' },
      expectedError: 'password',
    },
    {
      name: 'No uppercase letter',
      data: { name: 'Test User', email: 'test@example.com', password: 'weakpass123!' },
      expectedError: 'password',
    },
    {
      name: 'No lowercase letter',
      data: { name: 'Test User', email: 'test@example.com', password: 'WEAKPASS123!' },
      expectedError: 'password',
    },
    {
      name: 'No number',
      data: { name: 'Test User', email: 'test@example.com', password: 'WeakPass!' },
      expectedError: 'password',
    },
    {
      name: 'No special character',
      data: { name: 'Test User', email: 'test@example.com', password: 'WeakPass123' },
      expectedError: 'password',
    },
    {
      name: 'Empty password',
      data: { name: 'Test User', email: 'test@example.com', password: '' },
      expectedError: 'password',
    },
  ],
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testRegistrationEndpoint(testCase, expectedStatus = 400) {
  try {
    const response = await axios.post(REGISTER_ENDPOINT, testCase.data, {
      timeout: 5000,
      validateStatus: () => true, // Don't throw on 4xx/5xx
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Server not running on port 3001',
        code: 'ECONNREFUSED',
      };
    }
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

function validateErrorResponse(response, testCase, category) {
  const issues = [];

  // Check status code
  if (response.status !== 400) {
    issues.push(`Expected status 400, got ${response.status}`);
  }

  // Check response structure
  if (!response.data) {
    issues.push('No response data');
    return issues;
  }

  const { success, message, errors, data } = response.data;

  // Check success flag
  if (success !== false) {
    issues.push(`Expected success: false, got: ${success}`);
  }

  // Check error message exists
  if (!message) {
    issues.push('No error message provided');
  }

  // Check specific validation based on category
  switch (category) {
    case 'missingFields':
      if (!errors || !Array.isArray(errors)) {
        issues.push('Expected errors array for missing fields');
      } else {
        testCase.expectedErrors.forEach(field => {
          const hasFieldError = errors.some(
            error =>
              error.toLowerCase().includes(field) ||
              (typeof error === 'object' && error.field === field)
          );
          if (!hasFieldError) {
            issues.push(`Missing validation error for field: ${field}`);
          }
        });
      }
      break;

    case 'invalidEmail':
    case 'weakPassword':
      if (!errors || errors.length === 0) {
        issues.push(`Expected validation errors for ${category}`);
      } else {
        const hasRelevantError = errors.some(error => {
          const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
          return errorStr.toLowerCase().includes(testCase.expectedError);
        });
        if (!hasRelevantError) {
          issues.push(`Expected error related to ${testCase.expectedError}`);
        }
      }
      break;
  }

  // Check that no sensitive data is returned
  if (data && data.password) {
    issues.push('Password returned in error response (security issue)');
  }

  return issues;
}

async function runTestCategory(categoryName, testCases) {
  log(`\n=== Testing ${categoryName} ===`, 'cyan');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    log(`\nTesting: ${testCase.name}`, 'blue');
    log(`Data: ${JSON.stringify(testCase.data)}`, 'yellow');

    const response = await testRegistrationEndpoint(testCase);

    if (!response.success) {
      log(`❌ Request failed: ${response.error}`, 'red');
      failed++;
      continue;
    }

    const issues = validateErrorResponse(response, testCase, categoryName);

    if (issues.length === 0) {
      log(`✅ PASS`, 'green');
      passed++;
    } else {
      log(`❌ FAIL`, 'red');
      issues.forEach(issue => log(`   - ${issue}`, 'red'));
      log(`   Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
      failed++;
    }
  }

  log(
    `\n${categoryName} Results: ${passed} passed, ${failed} failed`,
    failed === 0 ? 'green' : 'red'
  );

  return { passed, failed };
}

async function testServerAvailability() {
  log('=== Testing Server Availability ===', 'cyan');

  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    log(`✅ Server is running (status: ${response.status})`, 'green');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log(`❌ Server not running on ${BASE_URL}`, 'red');
      log('Please start the server with: cd server && npm run dev', 'yellow');
    } else {
      log(`❌ Server health check failed: ${error.message}`, 'red');
    }
    return false;
  }
}

async function testValidRegistration() {
  log('\n=== Testing Valid Registration (Control Test) ===', 'cyan');

  const validData = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`, // Unique email
    password: 'ValidPass123!',
  };

  log(`Testing valid registration with: ${JSON.stringify(validData)}`, 'blue');

  const response = await testRegistrationEndpoint(validData, 201);

  if (!response.success) {
    log(`❌ Request failed: ${response.error}`, 'red');
    return false;
  }

  if (response.status === 201) {
    log(`✅ Valid registration works (status: ${response.status})`, 'green');
    return true;
  } else {
    log(`❌ Expected status 201, got ${response.status}`, 'red');
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
    return false;
  }
}

async function main() {
  log('🚀 Starting Authentication Error Validation Tests', 'magenta');
  log(`Target: ${BASE_URL}`, 'cyan');

  // Check server availability
  const serverAvailable = await testServerAvailability();
  if (!serverAvailable) {
    process.exit(1);
  }

  // Test valid registration first (control test)
  const validRegistrationWorks = await testValidRegistration();
  if (!validRegistrationWorks) {
    log('\n❌ Valid registration failed - cannot proceed with error tests', 'red');
    process.exit(1);
  }

  // Run all error validation tests
  let totalPassed = 0;
  let totalFailed = 0;

  for (const [categoryName, testCases] of Object.entries(TEST_CASES)) {
    const results = await runTestCategory(categoryName, testCases);
    totalPassed += results.passed;
    totalFailed += results.failed;
  }

  // Final summary
  log('\n' + '='.repeat(50), 'cyan');
  log('📊 FINAL RESULTS', 'magenta');
  log('='.repeat(50), 'cyan');
  log(`Total Tests: ${totalPassed + totalFailed}`, 'blue');
  log(`Passed: ${totalPassed}`, 'green');
  log(`Failed: ${totalFailed}`, totalFailed === 0 ? 'green' : 'red');
  log(
    `Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
    totalFailed === 0 ? 'green' : 'yellow'
  );

  if (totalFailed === 0) {
    log('\n🎉 All authentication error validation tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the error handling implementation.', 'red');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n⚠️  Tests interrupted by user', 'yellow');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\n❌ Unhandled rejection: ${reason}`, 'red');
  process.exit(1);
});

// Run the tests
main().catch(error => {
  log(`\n❌ Test execution failed: ${error.message}`, 'red');
  process.exit(1);
});
