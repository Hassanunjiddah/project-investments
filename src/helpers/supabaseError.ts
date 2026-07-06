import { AuthError, PostgrestError } from '@supabase/supabase-js';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  email_not_confirmed: 'Please confirm your email before signing in.',
  user_not_found: 'No account found with that email.',
};

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isAuthError(error)) {
    const message =
      AUTH_MESSAGES[error.code ?? ''] ??
      error.message ??
      'Authentication failed. Please try again.';
    return new AppError(message);
  }

  if (isPostgrestError(error)) {
    if (error.code === 'PGRST116') {
      return new AppError('Record not found.');
    }
    if (error.code === '42P01') {
      return new AppError('This feature is not yet available.');
    }
    return new AppError(error.message || 'Something went wrong. Please try again.');
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError('Something went wrong. Please try again.');
}

function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && 'status' in error && 'message' in error;
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}
