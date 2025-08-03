#!/usr/bin/env node

/**
 * Authentication Validation Test Script
 * Tests all error handling and validation scenarios for the authentication system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/auth';

// Test configuration
const testConfig = {
  timeout: 10000,
  validateStatus: () => true, // Don't throw on HTTP error status codes
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Helper function to log test results
function logTest(testName, passed, expected, actual, error = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}`);

  if (!passed) {
    console.log(`  Expected: ${JSON.stringify(expected, null, 2)}`);
    console.log(`  Actual: ${JSON.stringify(actual, null, 2)}`);
    if (error) {
      console.log(`  Error: ${error.message}`);
    }
  }

  testResults.tests.push({
    name: testName,
    passed,
    expected,
    actual,
    error: error?.message,
  });

  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// Helper function to make API requests
async function makeRequest(endpoint, data, method = 'POST') {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      ...testConfig,
    });

    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { message: error.message },
      error: error.message,
    };
  }
}

// Test 1: Registration with missing required fields
async function testMissingRequiredFields() {
  console.log('\n🧪 Testing registration with missing required fields...');

  const testCases = [
    {
      name: 'Missing email',
      data: { password: 'ValidPass123!', name: 'Test User' },
      expectedField: 'email',
    },
    {
      name: 'Missing password',
      data: { email: 'test@example.com', name: 'Test User' },
      expectedField: 'password',
    },
    {
      name: 'Missing name',
      data: { email: 'test@example.com', password: 'ValidPass123!' },
      expectedField: 'name',
    },
    {
      name: 'Missing all fields',
      data: {},
      expectedField: 'email', // First required field
    },
  ];

  for (const testCase of testCases) {
    const response = await makeRequest('/register', testCase.data);

    const expectedStatus = 400;
    const expectedCode = 'VALIDATION_ERROR';

    const statusMatch = response.status === expectedStatus;
    const codeMatch = response.data?.code === expectedCode;
    const hasValidationDetails = Array.isArray(response.data?.details);
    const hasExpectedField = response.data?.details?.some(
      detail => detail.field === testCase.expectedField
    );

    const passed = statusMatch && codeMatch && hasValidationDetails && hasExpectedField;

    logTest(
      testCase.name,
      passed,
      { status: expectedStatus, code: expectedCode, hasField: testCase.expectedField },
      {
        status: response.status,
        code: response.data?.code,
        details: response.data?.details,
      }
    );
  }
}

// Test 2: Registration with invalid email format
async function testInvalidEmailFormat() {
  console.log('\n🧪 Testing registration with invalid email format...');

  const testCases = [
    {
      name: 'Invalid email - no @',
      email: 'invalid-email',
    },
    {
      name: 'Invalid email - no domain',
      email: 'test@',
    },
    {
      name: 'Invalid email - no local part',
      email: '@example.com',
    },
    {
      name: 'Invalid email - multiple @',
      email: 'test@@example.com',
    },
    {
      name: 'Invalid email - spaces',
      email: 'test @example.com',
    },
  ];

  for (const testCase of testCases) {
    const response = await makeRequest('/register', {
      email: testCase.email,
      password: 'ValidPass123!',
      name: 'Test User',
    });

    const expectedStatus = 400;
    const expectedCode = 'VALIDATION_ERROR';

    const statusMatch = response.status === expectedStatus;
    const codeMatch = response.data?.code === expectedCode;
    const hasEmailValidationError = response.data?.details?.some(
      detail => detail.field === 'email' && detail.message.includes('valid email')
    );

    const passed = statusMatch && codeMatch && hasEmailValidationError;

    logTest(
      testCase.name,
      passed,
      { status: expectedStatus, code: expectedCode, emailError: true },
      {
        status: response.status,
        code: response.data?.code,
        details: response.data?.details,
      }
    );
  }
}

// Test 3: Registration with weak password
async function testWeakPassword() {
  console.log('\n🧪 Testing registration with weak password...');

  const testCases = [
    {
      name: 'Password too short',
      password: '1234567',
    },
    {
      name: 'Password without uppercase',
      password: 'lowercase123!',
    },
    {
      name: 'Password without lowercase',
      password: 'UPPERCASE123!',
    },
    {
      name: 'Password without numbers',
      password: 'ValidPassword!',
    },
    {
      name: 'Password without special characters',
      password: 'ValidPassword123',
    },
    {
      name: 'Password with only letters',
      password: 'OnlyLetters',
    },
    {
      name: 'Password with only numbers',
      password: '12345678',
    },
  ];

  for (const testCase of testCases) {
    const response = await makeRequest('/register', {
      email: 'test@example.com',
      password: testCase.password,
      name: 'Test User',
    });

    const expectedStatus = 400;
    const expectedCode = 'VALIDATION_ERROR';

    const statusMatch = response.status === expectedStatus;
    const codeMatch = response.data?.code === expectedCode;
    const hasPasswordValidationError = response.data?.details?.some(
      detail => detail.field === 'password'
    );

    const passed = statusMatch && codeMatch && hasPasswordValidationError;

    logTest(
      testCase.name,
      passed,
      { status: expectedStatus, code: expectedCode, passwordError: true },
      {
        status: response.status,
        code: response.data?.code,
        details: response.data?.details,
      }
    );
  }
}

// Test 4: Verify proper error messages are returned to client
async function testErrorMessageFormat() {
  console.log('\n🧪 Testing error message format and structure...');

  const testCases = [
    {
      name: 'Validation error structure',
      data: { email: 'invalid' },
      expectedStructure: {
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: 'array',
      },
    },
    {
      name: 'Duplicate email error',
      data: {
        email: 'existing@example.com',
        password: 'ValidPass123!',
        name: 'Test User',
      },
      expectedStructure: {
        success: false,
        code: 'USER_EXISTS',
      },
    },
  ];

  // First, create a user to test duplicate email
  await makeRequest('/register', {
    email: 'existing@example.com',
    password: 'ValidPass123!',
    name: 'Existing User',
  });

  for (const testCase of testCases) {
    const response = await makeRequest('/register', testCase.data);

    const hasCorrectStructure =
      typeof response.data?.success === 'boolean' &&
      typeof response.data?.message === 'string' &&
      typeof response.data?.code === 'string';

    let detailsValid = true;
    if (testCase.expectedStructure.details === 'array') {
      detailsValid = Array.isArray(response.data?.details);
    }

    const codeMatch = response.data?.code === testCase.expectedStructure.code;

    const passed = hasCorrectStructure && detailsValid && codeMatch;

    logTest(testCase.name, passed, testCase.expectedStructure, {
      success: response.data?.success,
      message: response.data?.message,
      code: response.data?.code,
      hasDetails: Array.isArray(response.data?.details),
    });
  }
}

// Test 5: Test login validation errors
async function testLoginValidation() {
  console.log('\n🧪 Testing login validation errors...');

  const testCases = [
    {
      name: 'Login with missing email',
      data: { password: 'password123' },
      expectedField: 'email',
    },
    {
      name: 'Login with missing password',
      data: { email: 'test@example.com' },
      expectedField: 'password',
    },
    {
      name: 'Login with invalid email format',
      data: { email: 'invalid-email', password: 'password123' },
      expectedField: 'email',
    },
  ];

  for (const testCase of testCases) {
    const response = await makeRequest('/login', testCase.data);

    const expectedStatus = 400;
    const expectedCode = 'VALIDATION_ERROR';

    const statusMatch = response.status === expectedStatus;
    const codeMatch = response.data?.code === expectedCode;
    const hasValidationDetails = Array.isArray(response.data?.details);

    const passed = statusMatch && codeMatch && hasValidationDetails;

    logTest(
      testCase.name,
      passed,
      { status: expectedStatus, code: expectedCode },
      {
        status: response.status,
        code: response.data?.code,
        details: response.data?.details,
      }
    );
  }
}

// Test 6: Test authentication error for invalid credentials
async function testInvalidCredentials() {
  console.log('\n🧪 Testing invalid credentials error...');

  const response = await makeRequest('/login', {
    email: 'nonexistent@example.com',
    password: 'wrongpassword',
  });

  const expectedStatus = 401;
  const expectedCode = 'INVALID_CREDENTIALS';

  const statusMatch = response.status === expectedStatus;
  const codeMatch = response.data?.code === expectedCode;
  const hasMessage = typeof response.data?.message === 'string';

  const passed = statusMatch && codeMatch && hasMessage;

  logTest(
    'Invalid credentials error',
    passed,
    { status: expectedStatus, code: expectedCode },
    {
      status: response.status,
      code: response.data?.code,
      message: response.data?.message,
    }
  );
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Authentication Validation Tests');
  console.log('='.repeat(50));

  try {
    // Check if server is running
    const healthCheck = await makeRequest('/validate', { token: 'test' });
    if (healthCheck.status >= 500) {
      console.log('❌ Server is not running or not accessible');
      console.log('Please start the server with: cd server && npm run dev');
      process.exit(1);
    }

    // Run all test suites
    await testMissingRequiredFields();
    await testInvalidEmailFormat();
    await testWeakPassword();
    await testErrorMessageFormat();
    await testLoginValidation();
    await testInvalidCredentials();

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
    console.log(
      `🎯 Success Rate: ${(
        (testResults.passed / (testResults.passed + testResults.failed)) *
        100
      ).toFixed(1)}%`
    );

    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}`);
        });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testMissingRequiredFields,
  testInvalidEmailFormat,
  testWeakPassword,
  testErrorMessageFormat,
  testLoginValidation,
  testInvalidCredentials,
};
