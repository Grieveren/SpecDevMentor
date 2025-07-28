# End-to-End Testing Suite

This directory contains comprehensive end-to-end tests for the CodeMentor-AI platform, including accessibility, security, performance, and compliance testing.

## Test Structure

### Test Files

- **`specification-workflow.spec.ts`** - Complete specification workflow testing
- **`collaboration.spec.ts`** - Multi-user collaboration scenarios
- **`ai-integration.spec.ts`** - AI-powered features testing
- **`performance.spec.ts`** - Performance and load testing
- **`accessibility.spec.ts`** - Accessibility compliance testing
- **`security.spec.ts`** - Security and penetration testing
- **`compliance.spec.ts`** - Data privacy and compliance testing
- **`smoke.spec.ts`** - Quick validation tests

### Fixtures

- **`fixtures/auth.ts`** - Authentication helpers and test users
- **`fixtures/project.ts`** - Project management helpers and test data

### Configuration

- **`global-setup.ts`** - Global test setup and environment preparation
- **`global-teardown.ts`** - Global test cleanup
- **`test-suites.config.ts`** - Configuration for different test suites

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Start the application services:
   ```bash
   pnpm dev  # Starts both client and server
   ```

### Test Commands

#### Individual Test Suites

```bash
# Quick smoke tests
pnpm test:smoke

# End-to-end workflow tests
pnpm test:e2e

# Accessibility tests
pnpm test:accessibility

# Security tests
pnpm test:security

# Performance tests
pnpm test:performance

# Compliance tests
pnpm test:compliance
```

#### Using the Test Runner Script

```bash
# Run all tests
./scripts/run-e2e-tests.sh all

# Run specific test suite
./scripts/run-e2e-tests.sh smoke
./scripts/run-e2e-tests.sh accessibility

# Run with Playwright UI
./scripts/run-e2e-tests.sh accessibility --ui

# Quick validation
pnpm test:smoke:run
```

#### Playwright UI Mode

```bash
# Run tests with interactive UI
pnpm test:e2e:ui
pnpm test:accessibility --ui
pnpm test:security --ui
```

#### Debug Mode

```bash
# Run tests in debug mode
pnpm test:e2e:debug
```

## Test Categories

### 🔥 Smoke Tests
Quick validation tests that verify basic functionality:
- Application loads correctly
- User authentication works
- Basic project operations function
- Core navigation works

### 🔄 End-to-End Tests
Complete workflow testing:
- Full specification workflow (Requirements → Design → Tasks → Implementation)
- Phase transitions and validation
- Document editing and saving
- AI review integration
- Workflow progress tracking

### 👥 Collaboration Tests
Multi-user scenarios:
- Real-time collaborative editing
- Comment and review systems
- Approval workflows
- Conflict resolution
- User presence indicators

### 🤖 AI Integration Tests
AI-powered features:
- Specification review and scoring
- Suggestion application and rollback
- EARS format validation
- Phase-specific guidance
- Error handling and rate limiting

### ⚡ Performance Tests
Load and performance testing:
- Concurrent user editing
- High-frequency AI requests
- Large document processing
- Memory usage efficiency
- UI responsiveness during heavy operations

### ♿ Accessibility Tests
WCAG compliance testing:
- Automated accessibility scanning with axe-core
- Keyboard navigation support
- Screen reader compatibility
- Color contrast validation
- Focus management
- ARIA labels and roles

### 🔒 Security Tests
Security and penetration testing:
- XSS prevention
- SQL injection protection
- Authentication and authorization
- CSRF protection
- Input validation and sanitization
- Session security
- File upload security

### 📋 Compliance Tests
Data privacy and security compliance:
- PII data handling
- Data retention policies
- Data export/deletion functionality
- Encryption at rest
- Secure session management
- Error handling without information disclosure

## Test Data

### Test Users
- **Admin**: `admin@codementor-ai.com` (ADMIN role)
- **Team Lead**: `lead@codementor-ai.com` (TEAM_LEAD role)
- **Developer**: `dev@codementor-ai.com` (DEVELOPER role)
- **Student**: `student@codementor-ai.com` (STUDENT role)

### Test Projects
- **E-commerce Platform**: Requirements phase testing
- **Real-time Chat Application**: Design phase testing
- **Task Management System**: Tasks phase testing

## Test Results

Test results are generated in the `test-results/` directory:

- **HTML Reports**: Interactive test reports with screenshots and videos
- **JSON Results**: Machine-readable test results
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Detailed execution traces for debugging

## Best Practices

### Writing Tests

1. **Use Page Object Pattern**: Utilize the helper classes in `fixtures/`
2. **Test Isolation**: Each test should be independent and clean up after itself
3. **Descriptive Names**: Use clear, descriptive test names that explain the scenario
4. **Proper Assertions**: Use appropriate Playwright assertions for better error messages
5. **Error Handling**: Test both success and failure scenarios

### Test Data Management

1. **Use Test Fixtures**: Leverage the predefined test users and projects
2. **Clean State**: Ensure tests start with a clean state
3. **Realistic Data**: Use realistic test data that matches production scenarios

### Performance Considerations

1. **Parallel Execution**: Most tests run in parallel for faster execution
2. **Resource Cleanup**: Always clean up resources after tests
3. **Timeout Configuration**: Set appropriate timeouts for different test types

## Troubleshooting

### Common Issues

1. **Services Not Running**: Ensure both client (port 5173) and server (port 3001) are running
2. **Browser Installation**: Run `npx playwright install` if browsers are missing
3. **Port Conflicts**: Check for conflicting processes on required ports
4. **Test Timeouts**: Increase timeout values for slower environments

### Debug Tips

1. **Use UI Mode**: Run tests with `--ui` flag for interactive debugging
2. **Screenshots**: Check `test-results/` for failure screenshots
3. **Console Logs**: Enable browser console logs in test configuration
4. **Trace Viewer**: Use Playwright trace viewer for detailed debugging

## CI/CD Integration

The test suite is designed to work in CI/CD environments:

1. **Headless Mode**: Tests run in headless mode by default
2. **Parallel Execution**: Configurable worker count for CI environments
3. **Retry Logic**: Automatic retries for flaky tests
4. **Multiple Reporters**: JSON and JUnit reporters for CI integration

## Contributing

When adding new tests:

1. Follow the existing test structure and patterns
2. Add appropriate test tags (`@accessibility`, `@security`, etc.)
3. Update this README if adding new test categories
4. Ensure tests are deterministic and don't rely on external services
5. Add proper error handling and cleanup

## Security Considerations

- Test credentials are for testing only and should not be used in production
- Security tests validate protection mechanisms but don't perform actual attacks
- Sensitive test data should be properly sanitized
- Test results may contain sensitive information and should be handled appropriately