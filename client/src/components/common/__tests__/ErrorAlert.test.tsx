import { InternalServerError } from '@shared/types/errors';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorAlert } from '../ErrorAlert';

describe('ErrorAlert', () => {
  it('should render error message', () => {
    const error = new InternalServerError('Test error message');

    render(<ErrorAlert error={error} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render with custom variant', () => {
    const error = new InternalServerError('Test error');

    render(<ErrorAlert error={error} variant="warning" />);

    // Should render the error regardless of variant
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should handle error objects without message', () => {
    const error = new Error();

    render(<ErrorAlert error={error} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
