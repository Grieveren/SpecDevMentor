import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { ForgotPasswordFormData, forgotPasswordSchema } from '../../utils/validation';
import { useAuthActions } from '../../stores/auth.store';
import { cn } from '../../utils/cn';

interface PasswordResetFormProps {
  onBack?: () => void;
  onSuccess?: () => void;
  className?: string;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onBack,
  onSuccess,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { requestPasswordReset } = useAuthActions();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (_data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    
    try {
      await requestPasswordReset(data.email);
      setIsSuccess(true);
      onSuccess?.();
    } catch (_error: unknown) {
      if (error.details) {
        error.details.forEach((detail: unknown) => {
          setError(detail.field as keyof ForgotPasswordFormData, {
            message: detail.message,
          });
        });
      } else {
        setError('root', { message: error.error || 'Failed to send reset email' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={cn('w-full max-w-md mx-auto', className)}>
        <div className="bg-white shadow-lg rounded-lg px-8 py-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              If an account with that email exists, we've sent you a password reset link.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center text-blue-600 hover:text-blue-500"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-md mx-auto', className)}>
      <div className="bg-white shadow-lg rounded-lg px-8 py-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
          <p className="text-gray-600 mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              id="email"
              autoComplete="email"
              className={cn(
                'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                errors.email ? 'border-red-300' : 'border-gray-300'
              )}
              placeholder="Enter your email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Root Error */}
          {errors.root && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.root.message}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>

          {/* Back to Login */}
          {onBack && (
            <div className="text-center pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center text-blue-600 hover:text-blue-500"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Back to Sign In
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};