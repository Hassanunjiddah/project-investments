import { AuthError, PostgrestError } from '@supabase/supabase-js';

export class AppError extends Error {
  details?: string;
  constructor(message: string, details?: string | null) {
    super(message);
    this.name = 'AppError';
    if (details) this.details = details;
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
    return new AppError(error.message || 'Something went wrong. Please try again.', error.details);
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError('Something went wrong. Please try again.');
}

/**
 * Prefer the `{ error }` body from a failed edge-function Response over the
 * generic supabase-js "non-2xx status code" message.
 */
export async function messageFromFunctionsError(error: unknown): Promise<string | null> {
  const err = error as {
    message?: string;
    context?: Response | { json?: () => Promise<{ error?: string }> };
  };
  if (!err?.context) return err?.message ?? null;

  try {
    if (typeof Response !== 'undefined' && err.context instanceof Response) {
      const body = (await err.context.clone().json().catch(() => null)) as {
        error?: string;
      } | null;
      if (body?.error) return body.error;
      const text = await err.context.clone().text().catch(() => '');
      if (text) return text.slice(0, 240);
    }
  } catch {
    /* fall through */
  }

  try {
    const ctx = err.context as { json?: () => Promise<{ error?: string }> };
    if (typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) return body.error;
    }
  } catch {
    /* fall through */
  }

  return err.message ?? null;
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
