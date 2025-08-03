// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import { LoginForm } from '../LoginForm';
import type { LoginFormProps } from '../LoginForm';

// Mock the auth store
const mockLogin = vi.fn();
vi.mock('../../../stores/auth.store', () => ({
  useAuthActions: () => ({
    login: mockLogin,
  }),
}));

describe('LoginForm', () => {
  const mockOnSuccess: MockedFunction<() => void> = vi.fn();
  const mockOnSwitchToRegister: MockedFunction<() => void> = vi.fn();
  const mockOnForgotPassword: MockedFunction<() => void> = vi.fn();

  const defaultProps: LoginFormProps = {
    onSuccess: mockOnSuccess,
    onSwitchToRegister: mockOnSwitchToRegister,
    onForgotPassword: mockOnForgotPassword,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockClear();
  });

  it('renders login form with all fields', () => {
    render(<LoginForm {...defaultProps} />);

    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm {...defaultProps} />);

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm {...defaultProps} />);

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls onSwitchToRegister when sign up link is clicked', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm {...defaultProps} />);

    const signUpLink = screen.getByText(/sign up/i);
    await user.click(signUpLink);

    expect(mockOnSwitchToRegister).toHaveBeenCalledTimes(1);
  });

  it('calls onForgotPassword when forgot password link is clicked', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm {...defaultProps} />);

    const forgotPasswordLink = screen.getByText(/forgot your password/i);
    await user.click(forgotPasswordLink);

    expect(mockOnForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: true });

    render(<LoginForm {...defaultProps} />);

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });
});