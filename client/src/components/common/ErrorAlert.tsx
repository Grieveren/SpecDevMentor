import React from 'react';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ErrorSeverity,
  NetworkError,
  NotFoundError,
  ValidationError,
  isErrorOfType,
} from '@shared/types/errors';

interface ErrorAlertProps {
  error: AppError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
  showDetails?: boolean;
}

interface ValidationEntry {
  key: string;
  label: string;
  messages: string[];
}

const normalizeValidationEntries = (error: ValidationError): ValidationEntry[] => {
  const contextErrors = (error.context?.errors ?? null) as unknown;
  const entries: ValidationEntry[] = [];

  if (Array.isArray(contextErrors)) {
    contextErrors.forEach((message, index) => {
      entries.push({
        key: `${error.field ?? 'message'}-${index}`,
        label: error.field ?? `Issue ${index + 1}`,
        messages: [String(message)],
      });
    });
    return entries;
  }

  if (contextErrors && typeof contextErrors === 'object') {
    Object.entries(contextErrors as Record<string, unknown>).forEach(([field, messages]) => {
      const normalizedMessages = Array.isArray(messages)
        ? messages.map(msg => String(msg))
        : [String(messages)];
      entries.push({ key: field, label: field, messages: normalizedMessages });
    });
    return entries;
  }

  if (error.field) {
    entries.push({ key: error.field, label: error.field, messages: [error.message] });
  }

  return entries;
};

/**
 * Inline error alert component for displaying errors within forms and components
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onDismiss,
  onRetry,
  className = '',
  showDetails = false,
}) => {
  if (!error) return null;

  const getErrorSeverity = (appError: AppError): ErrorSeverity => {
    if (appError.statusCode >= 500) return ErrorSeverity.CRITICAL;
    if (appError.statusCode >= 400) return ErrorSeverity.HIGH;
    return ErrorSeverity.MEDIUM;
  };

  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'bg-red-50 border-red-200 text-red-800';
      case ErrorSeverity.HIGH:
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case ErrorSeverity.LOW:
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getErrorIcon = () => {
    const iconClass = 'h-5 w-5';

    if (isErrorOfType(error, ValidationError)) {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      );
    }

    if (isErrorOfType(error, AuthenticationError) || isErrorOfType(error, AuthorizationError)) {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      );
    }

    if (isErrorOfType(error, NetworkError)) {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
          />
        </svg>
      );
    }

    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  };

  const getErrorTitle = () => {
    if (isErrorOfType(error, ValidationError)) {
      return 'Validation Error';
    }

    if (isErrorOfType(error, AuthenticationError)) {
      return 'Authentication Required';
    }

    if (isErrorOfType(error, AuthorizationError)) {
      return 'Access Denied';
    }

    if (isErrorOfType(error, NotFoundError)) {
      return 'Not Found';
    }

    if (isErrorOfType(error, NetworkError)) {
      return 'Connection Error';
    }

    return 'Error';
  };

  const severity = getErrorSeverity(error);
  const severityStyles = getSeverityStyles(severity);
  const validationEntries = isErrorOfType(error, ValidationError)
    ? normalizeValidationEntries(error)
    : [];

  return (
    <div className={`rounded-md border p-4 ${severityStyles} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">{getErrorIcon()}</div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{getErrorTitle()}</h3>
          <div className="mt-2 text-sm">
            <p>{error.message}</p>

            {validationEntries.length > 0 && (
              <div className="mt-2">
                <ul className="list-disc list-inside space-y-1">
                  {validationEntries.map(entry => (
                    <li key={entry.key}>
                      <span className="font-medium">{entry.label}:</span>{' '}
                      {entry.messages.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showDetails && error.context && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium">Technical Details</summary>
                <pre className="mt-1 text-xs bg-white bg-opacity-50 p-2 rounded overflow-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              </details>
            )}
          </div>

          {(onRetry || onDismiss) && (
            <div className="mt-4 flex space-x-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-sm bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded border border-current border-opacity-20 hover:border-opacity-30 transition-colors"
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-sm bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded border border-current border-opacity-20 hover:border-opacity-30 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
