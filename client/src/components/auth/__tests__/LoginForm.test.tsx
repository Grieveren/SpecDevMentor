import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

// Mock the auth store
vi.mock('../../../stores/auth.store', () => ({
  useAuthActions: () => ({
    login: vi.fn(),
  }),
}));

describe('LoginForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnSwitchToRegister = vi.fn();
  const mockOnForgotPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all fields', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
        onForgotPassword={mockOnForgotPassword}
      />
    );

    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const _user = userEvent.setup();
    
    render(<LoginForm onSuccess={mockOnSuccess} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const _user = userEvent.setup();
    
    render(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const _user = userEvent.setup();
    
    render(<LoginForm onSuccess={mockOnSuccess} />);

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls onSwitchToRegister when sign up link is clicked', async () => {
    const _user = userEvent.setup();
    
    render(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const signUpLink = screen.getByText(/sign up/i);
    await user.click(signUpLink);

    expect(mockOnSwitchToRegister).toHaveBeenCalledTimes(1);
  });

  it('calls onForgotPassword when forgot password link is clicked', async () => {
    const _user = userEvent.setup();
    
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);

    const forgotPasswordLink = screen.getByText(/forgot your password/i);
    await user.click(forgotPasswordLink);

    expect(mockOnForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('submits form with valid data', async () => {
    const _user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue({});
    
    vi.mocked(require('../../../stores/auth.store').useAuthActions).mockReturnValue({
      login: mockLogin,
    });

    render(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
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