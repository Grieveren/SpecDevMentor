# Testing Standards

## Testing Framework Setup

- **Unit Tests**: Jest with React Testing Library
- **Integration Tests**: Jest with MSW for API mocking
- **Test Environment**: jsdom for DOM simulation
- **Coverage**: Aim for 80%+ code coverage on critical paths

## Component Testing Patterns

### Testing Structure

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  const defaultProps = {
    // Define minimal required props
  };

  it('should render with default props', () => {
    render(<ComponentName {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

### Testing Best Practices

- Test behavior, not implementation details
- Use semantic queries (getByRole, getByLabelText)
- Mock external dependencies and API calls
- Test error states and edge cases
- Use descriptive test names that explain the scenario

### API Testing with MSW

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json({ users: [] }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Utility Function Testing

- Test pure functions with various inputs
- Test error conditions and edge cases
- Use parameterized tests for multiple scenarios
- Mock external dependencies (localStorage, fetch, etc.)

## Test Organization

- Group related tests in describe blocks
- Use beforeEach/afterEach for setup/cleanup
- Keep tests isolated and independent
- Use factories for test data generation

## Accessibility Testing

- Test keyboard navigation
- Verify ARIA attributes
- Check color contrast and focus indicators
- Test screen reader compatibility
