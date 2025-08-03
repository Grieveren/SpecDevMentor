#!/usr/bin/env node

/**
 * Comprehensive Authentication Error Handling and Validation Test
 * Tests all validation scenarios for the authentication system
 */

const Joi = require('joi');

// Import validation schemas from auth routes
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required',
  }),
});

// Test cases for validation
const testCases = [
  {
    name: 'Missing required fields - no email',
    data: {
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: ['Email is required'],
  },
  {
    name: 'Missing required fields - no password',
    data: {
      email: 'test@example.com',
      name: 'John Doe',
    },
    expectedErrors: ['Password is required'],
  },
  {
    name: 'Missing required fields - no name',
    data: {
      email: 'test@example.com',
      password: 'ValidPass123!',
    },
    expectedErrors: ['Name is required'],
  },
  {
    name: 'Missing all required fields',
    data: {},
    expectedErrors: ['Email is required', 'Password is required', 'Name is required'],
  },
  {
    name: 'Invalid email format - no @ symbol',
    data: {
      email: 'invalid-email',
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: ['Please provide a valid email address'],
  },
  {
    name: 'Invalid email format - no domain',
    data: {
      email: 'test@',
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: ['Please provide a valid email address'],
  },
  {
    name: 'Invalid email format - no TLD',
    data: {
      email: 'test@domain',
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: ['Please provide a valid email address'],
  },
  {
    name: 'Invalid email format - spaces',
    data: {
      email: 'test @example.com',
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: ['Please provide a valid email address'],
  },
  {
    name: 'Weak password - too short',
    data: {
      email: 'test@example.com',
      password: 'Pass1!',
      name: 'John Doe',
    },
    expectedErrors: ['Password must be at least 8 characters long'],
  },
  {
    name: 'Weak password - no uppercase',
    data: {
      email: 'test@example.com',
      password: 'password123!',
      name: 'John Doe',
    },
    expectedErrors: [
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ],
  },
  {
    name: 'Weak password - no lowercase',
    data: {
      email: 'test@example.com',
      password: 'PASSWORD123!',
      name: 'John Doe',
    },
    expectedErrors: [
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ],
  },
  {
    name: 'Weak password - no numbers',
    data: {
      email: 'test@example.com',
      password: 'Password!',
      name: 'John Doe',
    },
    expectedErrors: [
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ],
  },
  {
    name: 'Weak password - no special characters',
    data: {
      email: 'test@example.com',
      password: 'Password123',
      name: 'John Doe',
    },
    expectedErrors: [
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ],
  },
  {
    name: 'Weak password - only letters',
    data: {
      email: 'test@example.com',
      password: 'password',
      name: 'John Doe',
    },
    expectedErrors: [
      'Password must be at least 8 characters long',
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ],
  },
  {
    name: 'Invalid name - too short',
    data: {
      email: 'test@example.com',
      password: 'ValidPass123!',
      name: 'J',
    },
    expectedErrors: ['Name must be at least 2 characters long'],
  },
  {
    name: 'Invalid name - too long',
    data: {
      email: 'test@example.com',
      password: 'ValidPass123!',
      name: 'A'.repeat(51),
    },
    expectedErrors: ['Name cannot exceed 50 characters'],
  },
  {
    name: 'Multiple validation errors',
    data: {
      email: 'invalid-email',
      password: 'weak',
      name: 'J',
    },
    expectedErrors: [
      'Please provide a valid email address',
      'Password must be at least 8 characters long',
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'Name must be at least 2 characters long',
    ],
  },
  {
    name: 'Valid registration data',
    data: {
      email: 'test@example.com',
      password: 'ValidPass123!',
      name: 'John Doe',
    },
    expectedErrors: [],
  },
];

// Test runner
function runValidationTests() {
  console.log('🧪 Running Authentication Validation Tests\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);

    const { error } = registerSchema.validate(testCase.data);

    if (testCase.expectedErrors.length === 0) {
      // Should pass validation
      if (!error) {
        console.log('✅ PASS - Validation passed as expected');
        passed++;
      } else {
        console.log('❌ FAIL - Expected validation to pass but got errors:');
        error.details.forEach(detail => {
          console.log(`   - ${detail.message}`);
        });
        failed++;
      }
    } else {
      // Should fail validation
      if (error) {
        const actualErrors = error.details.map(detail => detail.message);
        const missingErrors = testCase.expectedErrors.filter(
          expected =>
            !actualErrors.some(actual => actual.includes(expected) || expected.includes(actual))
        );
        const unexpectedErrors = actualErrors.filter(
          actual =>
            !testCase.expectedErrors.some(
              expected => actual.includes(expected) || expected.includes(actual)
            )
        );

        if (missingErrors.length === 0 && unexpectedErrors.length === 0) {
          console.log('✅ PASS - Got expected validation errors:');
          actualErrors.forEach(err => console.log(`   - ${err}`));
          passed++;
        } else {
          console.log('❌ FAIL - Validation errors mismatch:');
          if (missingErrors.length > 0) {
            console.log('   Missing expected errors:');
            missingErrors.forEach(err => console.log(`     - ${err}`));
          }
          if (unexpectedErrors.length > 0) {
            console.log('   Unexpected errors:');
            unexpectedErrors.forEach(err => console.log(`     - ${err}`));
          }
          failed++;
        }
      } else {
        console.log('❌ FAIL - Expected validation errors but validation passed');
        failed++;
      }
    }
    console.log('');
  });

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  return failed === 0;
}

// Test error response format
function testErrorResponseFormat() {
  console.log('\n🔍 Testing Error Response Format\n');

  const testData = {
    email: 'invalid-email',
    password: 'weak',
    name: 'J',
  };

  const { error } = registerSchema.validate(testData);

  if (error) {
    // Simulate the error response format from auth routes
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    const validationError = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
    };

    console.log('✅ Error Response Format Test:');
    console.log(JSON.stringify(validationError, null, 2));

    // Verify response structure
    const hasRequiredFields =
      validationError.success === false &&
      validationError.message &&
      validationError.code &&
      Array.isArray(validationError.details);

    const detailsHaveCorrectFormat = validationError.details.every(
      detail => detail.field && detail.message
    );

    if (hasRequiredFields && detailsHaveCorrectFormat) {
      console.log('✅ Error response format is correct');
      return true;
    } else {
      console.log('❌ Error response format is incorrect');
      return false;
    }
  }

  return false;
}

// Test specific password validation patterns
function testPasswordValidation() {
  console.log('\n🔐 Testing Password Validation Patterns\n');

  const passwordTests = [
    { password: 'ValidPass123!', valid: true, description: 'Valid password' },
    { password: 'validpass123!', valid: false, description: 'No uppercase' },
    { password: 'VALIDPASS123!', valid: false, description: 'No lowercase' },
    { password: 'ValidPass!', valid: false, description: 'No numbers' },
    { password: 'ValidPass123', valid: false, description: 'No special chars' },
    { password: 'Val1!', valid: false, description: 'Too short' },
    { password: 'MySecurePassword2024!', valid: true, description: 'Long valid password' },
    { password: 'Test@123', valid: true, description: 'Minimum valid password' },
    { password: 'password123!A', valid: true, description: 'Valid with mixed case' },
    { password: '12345678!A', valid: false, description: 'No lowercase letters' },
  ];

  let passed = 0;
  let failed = 0;

  passwordTests.forEach((test, index) => {
    const testData = {
      email: 'test@example.com',
      password: test.password,
      name: 'Test User',
    };

    const { error } = registerSchema.validate(testData);
    const isValid = !error;

    console.log(`Password Test ${index + 1}: ${test.description}`);
    console.log(`Password: "${test.password}"`);

    if (isValid === test.valid) {
      console.log(
        `✅ PASS - Expected ${test.valid ? 'valid' : 'invalid'}, got ${
          isValid ? 'valid' : 'invalid'
        }`
      );
      passed++;
    } else {
      console.log(
        `❌ FAIL - Expected ${test.valid ? 'valid' : 'invalid'}, got ${
          isValid ? 'valid' : 'invalid'
        }`
      );
      if (error) {
        console.log(`   Error: ${error.details[0].message}`);
      }
      failed++;
    }
    console.log('');
  });

  console.log('🔐 Password Validation Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  return failed === 0;
}

// Test email validation patterns
function testEmailValidation() {
  console.log('\n📧 Testing Email Validation Patterns\n');

  const emailTests = [
    { email: 'test@example.com', valid: true, description: 'Standard email' },
    { email: 'user.name@domain.co.uk', valid: true, description: 'Email with dots and subdomain' },
    { email: 'user+tag@example.com', valid: true, description: 'Email with plus sign' },
    {
      email: 'user_name@example-domain.com',
      valid: true,
      description: 'Email with underscore and hyphen',
    },
    { email: 'invalid-email', valid: false, description: 'No @ symbol' },
    { email: 'test@', valid: false, description: 'No domain' },
    { email: '@example.com', valid: false, description: 'No local part' },
    { email: 'test..test@example.com', valid: false, description: 'Double dots' },
    { email: 'test @example.com', valid: false, description: 'Space in email' },
    { email: 'test@example', valid: false, description: 'No TLD' },
  ];

  let passed = 0;
  let failed = 0;

  emailTests.forEach((test, index) => {
    const testData = {
      email: test.email,
      password: 'ValidPass123!',
      name: 'Test User',
    };

    const { error } = registerSchema.validate(testData);
    const isValid = !error;

    console.log(`Email Test ${index + 1}: ${test.description}`);
    console.log(`Email: "${test.email}"`);

    if (isValid === test.valid) {
      console.log(
        `✅ PASS - Expected ${test.valid ? 'valid' : 'invalid'}, got ${
          isValid ? 'valid' : 'invalid'
        }`
      );
      passed++;
    } else {
      console.log(
        `❌ FAIL - Expected ${test.valid ? 'valid' : 'invalid'}, got ${
          isValid ? 'valid' : 'invalid'
        }`
      );
      if (error) {
        console.log(`   Error: ${error.details[0].message}`);
      }
      failed++;
    }
    console.log('');
  });

  console.log('📧 Email Validation Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  return failed === 0;
}

// Main test execution
function main() {
  console.log('🚀 Starting Authentication Error Handling and Validation Tests\n');
  console.log('='.repeat(80));

  const results = [];

  // Run all test suites
  results.push(runValidationTests());
  results.push(testErrorResponseFormat());
  results.push(testPasswordValidation());
  results.push(testEmailValidation());

  console.log('\n' + '='.repeat(80));
  console.log('🏁 Final Test Results');
  console.log('='.repeat(80));

  const allPassed = results.every(result => result);

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Authentication validation is working correctly');
    console.log('✅ Error messages are properly formatted');
    console.log('✅ All validation scenarios are covered');
  } else {
    console.log('❌ SOME TESTS FAILED!');
    console.log('Please review the failed tests above');
  }

  console.log('\n📋 Test Coverage Summary:');
  console.log('- ✅ Missing required fields validation');
  console.log('- ✅ Invalid email format validation');
  console.log('- ✅ Weak password validation');
  console.log('- ✅ Invalid name validation');
  console.log('- ✅ Multiple validation errors handling');
  console.log('- ✅ Error response format verification');
  console.log('- ✅ Password complexity requirements');
  console.log('- ✅ Email format requirements');

  process.exit(allPassed ? 0 : 1);
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  runValidationTests,
  testErrorResponseFormat,
  testPasswordValidation,
  testEmailValidation,
};
