#!/usr/bin/env node

/**
 * Comprehensive Authentication Validation Test
 * Tests all error handling and validation scenarios for the authentication system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/auth';

// Test configuration
const TEST_CONFIG = {
  timeout: 10000,
  retries: 3,
  delay: 1000,
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
};

// Utility functions
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const logTest = (testName, passed, details = '') => {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}`);
    if (details) console.log(`   ${details}`);
  }
  testResults.details.push({ testName, passed, details });
};

const makeRequest = async (method, endpoint, data = null, expectedStatus = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: TEST_CONFIG.timeout,
      validateStatus: () => true, // Don't throw on any status code
    };

    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);

    if (expectedStatus && response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }

    return response;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Server not running. Please start the development server first.');
    }
    throw error;
  }
};

// Test functions
async function testMissingRequiredFields() {
  console.log('\n🧪 Testing registration with missing required fields...');

  // Test missing email
  try {
    const response = await makeRequest(
      'POST',
      '/register',
      {
        password: 'ValidPass123!',
        name: 'Test User',
      },
      400
    );

    const isValid =
      response.data.success === false &&
      response.data.code === 'VALIDATION_ERROR' &&
      response.data.details.some(d => d.field === 'email' && d.message.includes('required'));

    logTest(
      'Missing email field validation',
      isValid,
      isValid
        ? ''
        : `Expected validation error for missing email, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Missing email field validation', false, error.message);
  }

  // Test missing password
  try {
    const response = await makeRequest(
      'POST',
      '/register',
      {
        email: 'test@example.com',
        name: 'Test User',
      },
      400
    );

    const isValid =
      response.data.success === false &&
      response.data.code === 'VALIDATION_ERROR' &&
      response.data.details.some(d => d.field === 'password' && d.message.includes('required'));

    logTest(
      'Missing password field validation',
      isValid,
      isValid
        ? ''
        : `Expected validation error for missing password, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Missing password field validation', false, error.message);
  }

  // Test missing name
  try {
    const response = await makeRequest(
      'POST',
      '/register',
      {
        email: 'test@example.com',
        password: 'ValidPass123!',
      },
      400
    );

    const isValid =
      response.data.success === false &&
      response.data.code === 'VALIDATION_ERROR' &&
      response.data.details.some(d => d.field === 'name' && d.message.includes('required'));

    logTest(
      'Missing name field validation',
      isValid,
      isValid
        ? ''
        : `Expected validation error for missing name, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Missing name field validation', false, error.message);
  }

  // Test completely empty body
  try {
    const response = await makeRequest('POST', '/register', {}, 400);

    const isValid =
      response.data.success === false &&
      response.data.code === 'VALIDATION_ERROR' &&
      response.data.details.length >= 3; // Should have errors for all required fields

    logTest(
      'Empty request body validation',
      isValid,
      isValid
        ? ''
        : `Expected validation errors for all fields, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Empty request body validation', false, error.message);
  }
}

async function testInvalidEmailFormat() {
  console.log('\n🧪 Testing registration with invalid email formats...');

  const invalidEmails = [
    'invalid-email',
    'invalid@',
    '@invalid.com',
    'invalid@.com',
    'invalid.com',
    'invalid@com',
    'invalid..email@test.com',
    'invalid@test..com',
    ' invalid@test.com',
    'invalid@test.com ',
    'invalid@test.com.',
    '.invalid@test.com',
  ];

  for (const email of invalidEmails) {
    try {
      const response = await makeRequest(
        'POST',
        '/register',
        {
          email: email,
          password: 'ValidPass123!',
          name: 'Test User',
        },
        400
      );

      const isValid =
        response.data.success === false &&
        response.data.code === 'VALIDATION_ERROR' &&
        response.data.details.some(d => d.field === 'email' && d.message.includes('valid email'));

      logTest(
        `Invalid email format: "${email}"`,
        isValid,
        isValid ? '' : `Expected email validation error, got: ${JSON.stringify(response.data)}`
      );
    } catch (error) {
      logTest(`Invalid email format: "${email}"`, false, error.message);
    }

    await sleep(100); // Small delay to avoid overwhelming the server
  }
}

async function testWeakPasswords() {
  console.log('\n🧪 Testing registration with weak passwords...');

  const weakPasswords = [
    'short', // Too short
    'password', // No uppercase, numbers, or special chars
    'PASSWORD', // No lowercase, numbers, or special chars
    '12345678', // No letters or special chars
    'Password', // No numbers or special chars
    'Password123', // No special chars
    'Password!', // No numbers
    'password123!', // No uppercase
    'PASSWORD123!', // No lowercase
    'Pass!1', // Too short but has all requirements
    '       ', // Only spaces
    '', // Empty string
  ];

  for (const password of weakPasswords) {
    try {
      const response = await makeRequest(
        'POST',
        '/register',
        {
          email: 'test@example.com',
          password: password,
          name: 'Test User',
        },
        400
      );

      const isValid =
        response.data.success === false &&
        response.data.code === 'VALIDATION_ERROR' &&
        response.data.details.some(d => d.field === 'password');

      logTest(
        `Weak password: "${password}"`,
        isValid,
        isValid ? '' : `Expected password validation error, got: ${JSON.stringify(response.data)}`
      );
    } catch (error) {
      logTest(`Weak password: "${password}"`, false, error.message);
    }

    await sleep(100);
  }
}

async function testInvalidNameFormats() {
  console.log('\n🧪 Testing registration with invalid name formats...');

  const invalidNames = [
    'A', // Too short
    'A'.repeat(51), // Too long
    '', // Empty
    '   ', // Only spaces
    null, // Null value
    undefined, // Undefined value
  ];

  for (const name of invalidNames) {
    try {
      const requestData = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: name,
      };

      // Remove undefined values
      if (name === undefined) {
        delete requestData.name;
      }

      const response = await makeRequest('POST', '/register', requestData, 400);

      const isValid =
        response.data.success === false &&
        response.data.code === 'VALIDATION_ERROR' &&
        response.data.details.some(d => d.field === 'name');

      logTest(
        `Invalid name: "${name}"`,
        isValid,
        isValid ? '' : `Expected name validation error, got: ${JSON.stringify(response.data)}`
      );
    } catch (error) {
      logTest(`Invalid name: "${name}"`, false, error.message);
    }

    await sleep(100);
  }
}

async function testDuplicateEmailRegistration() {
  console.log('\n🧪 Testing duplicate email registration...');

  const testEmail = `test-duplicate-${Date.now()}@example.com`;

  try {
    // First registration should succeed
    const firstResponse = await makeRequest('POST', '/register', {
      email: testEmail,
      password: 'ValidPass123!',
      name: 'First User',
    });

    const firstSuccess = firstResponse.status === 201 && firstResponse.data.success === true;
    logTest(
      'First registration with unique email',
      firstSuccess,
      firstSuccess
        ? ''
        : `Expected successful registration, got: ${JSON.stringify(firstResponse.data)}`
    );

    if (firstSuccess) {
      // Second registration with same email should fail
      const secondResponse = await makeRequest(
        'POST',
        '/register',
        {
          email: testEmail,
          password: 'ValidPass123!',
          name: 'Second User',
        },
        400
      );

      const secondFailed =
        secondResponse.data.success === false &&
        (secondResponse.data.code === 'USER_EXISTS' ||
          secondResponse.data.code === 'CONFLICT' ||
          secondResponse.data.message.toLowerCase().includes('exists'));

      logTest(
        'Duplicate email registration prevention',
        secondFailed,
        secondFailed ? '' : `Expected conflict error, got: ${JSON.stringify(secondResponse.data)}`
      );
    }
  } catch (error) {
    logTest('Duplicate email registration test', false, error.message);
  }
}

async function testProperErrorMessageFormat() {
  console.log('\n🧪 Testing error message format consistency...');

  try {
    const response = await makeRequest(
      'POST',
      '/register',
      {
        email: 'invalid-email',
        password: 'weak',
        name: 'A',
      },
      400
    );

    // Check error response structure
    const hasCorrectStructure =
      response.data.success === false &&
      typeof response.data.message === 'string' &&
      response.data.code === 'VALIDATION_ERROR' &&
      Array.isArray(response.data.details) &&
      response.data.details.length > 0;

    logTest(
      'Error response structure',
      hasCorrectStructure,
      hasCorrectStructure ? '' : `Invalid error structure: ${JSON.stringify(response.data)}`
    );

    // Check that each detail has required fields
    const detailsValid = response.data.details.every(
      detail => typeof detail.field === 'string' && typeof detail.message === 'string'
    );

    logTest(
      'Error details format',
      detailsValid,
      detailsValid ? '' : `Invalid detail format: ${JSON.stringify(response.data.details)}`
    );

    // Check that error messages are user-friendly
    const messagesUserFriendly = response.data.details.every(
      detail =>
        detail.message.length > 0 &&
        !detail.message.includes('ValidationError') &&
        !detail.message.includes('undefined')
    );

    logTest(
      'User-friendly error messages',
      messagesUserFriendly,
      messagesUserFriendly
        ? ''
        : `Non-user-friendly messages: ${JSON.stringify(response.data.details)}`
    );
  } catch (error) {
    logTest('Error message format test', false, error.message);
  }
}

async function testLoginValidation() {
  console.log('\n🧪 Testing login validation...');

  // Test missing email in login
  try {
    const response = await makeRequest(
      'POST',
      '/login',
      {
        password: 'ValidPass123!',
      },
      400
    );

    const isValid = response.data.success === false && response.data.code === 'VALIDATION_ERROR';

    logTest(
      'Login missing email validation',
      isValid,
      isValid ? '' : `Expected validation error, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Login missing email validation', false, error.message);
  }

  // Test missing password in login
  try {
    const response = await makeRequest(
      'POST',
      '/login',
      {
        email: 'test@example.com',
      },
      400
    );

    const isValid = response.data.success === false && response.data.code === 'VALIDATION_ERROR';

    logTest(
      'Login missing password validation',
      isValid,
      isValid ? '' : `Expected validation error, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Login missing password validation', false, error.message);
  }

  // Test invalid credentials
  try {
    const response = await makeRequest(
      'POST',
      '/login',
      {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      },
      401
    );

    const isValid = response.data.success === false && response.data.code === 'INVALID_CREDENTIALS';

    logTest(
      'Login invalid credentials',
      isValid,
      isValid ? '' : `Expected invalid credentials error, got: ${JSON.stringify(response.data)}`
    );
  } catch (error) {
    logTest('Login invalid credentials', false, error.message);
  }
}

async function testServerAvailability() {
  console.log('\n🔍 Checking server availability...');

  try {
    const response = await makeRequest('GET', '/../health');
    logTest(
      'Server health check',
      response.status === 200 || response.status === 404,
      'Server is responding'
    );
  } catch (error) {
    if (error.message.includes('Server not running')) {
      console.log('❌ Server is not running. Please start the development server first.');
      console.log('   Run: cd server && npm run dev');
      process.exit(1);
    }
    logTest('Server availability', false, error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive authentication validation tests...');
  console.log(`📍 Testing against: ${BASE_URL}`);

  // Check server availability first
  await testServerAvailability();

  // Run all validation tests
  await testMissingRequiredFields();
  await testInvalidEmailFormat();
  await testWeakPasswords();
  await testInvalidNameFormats();
  await testDuplicateEmailRegistration();
  await testProperErrorMessageFormat();
  await testLoginValidation();

  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total: ${testResults.total}`);
  console.log(`🎯 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(result => !result.passed)
      .forEach(result => {
        console.log(`   • ${result.testName}`);
        if (result.details) console.log(`     ${result.details}`);
      });
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
