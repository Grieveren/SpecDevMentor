# Code Quality & Formatting Standards

## ESLint Configuration

- Extend recommended configs for TypeScript and React
- Use Prettier integration for consistent formatting
- Enable React Hooks rules for proper hook usage
- Warn on console.log statements in production code

## Code Style Guidelines

### Variable Declarations

- Use `const` by default, `let` when reassignment needed
- Never use `var` - ESLint rule enforces this
- Use descriptive variable names that explain intent
- Prefer destructuring for object and array access

### Function Definitions

```typescript
// Prefer arrow functions for consistency
const handleSubmit = async (data: FormData): Promise<void> => {
  // Implementation
};

// Use function declarations for hoisted functions
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Type Definitions

- Define interfaces in separate files when shared
- Use generic constraints for reusable types
- Prefer union types over enums for string constants
- Document complex types with JSDoc comments

## Git Workflow Standards

### Commit Messages

Follow conventional commit format:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code restructuring
- `test:` adding or updating tests

### Pre-commit Hooks

- ESLint fixes applied automatically
- Prettier formatting enforced
- Type checking runs on staged files
- Tests must pass before commit

## Code Review Guidelines

- Review for logic correctness and edge cases
- Check TypeScript types and interfaces
- Verify accessibility compliance
- Ensure proper error handling
- Validate test coverage for new features

## Performance Considerations

- Use React.memo for expensive components
- Implement proper dependency arrays in hooks
- Avoid inline object/function creation in renders
- Use lazy loading for large components
- Optimize bundle size with proper imports
