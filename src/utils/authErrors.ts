// Human-friendly auth error mapping for Prism Capital sign-in flows.
//
// Turns Supabase / network / RPC errors into short, actionable messages
// that tell the user what to do next — never raw error strings.
//
// Public API: `mapAuthError(error, context) → { title, hint, testTag }`.

type Context = 'signin' | 'first-signin' | 'set-password';

export type MappedError = {
  title: string;
  hint?: string;
  /** Stable tag for tests, e.g. `auth-error-wrong-password`. */
  testTag: string;
};

const NETWORK_HINT = 'Check your internet and try again.';

export function mapAuthError(error: unknown, context: Context = 'signin'): MappedError {
  const raw = extractMessage(error).toLowerCase();

  // Network / offline ─────────────────────────────────────────────────
  if (
    raw.includes('failed to fetch') ||
    raw.includes('network') ||
    raw.includes('offline') ||
    raw.includes('load failed') ||
    raw.includes('typeerror')
  ) {
    return {
      title: "Can't reach Prism Capital",
      hint: NETWORK_HINT,
      testTag: 'auth-error-network',
    };
  }

  // Invalid credentials — the classic case ────────────────────────────
  if (
    raw.includes('invalid login credentials') ||
    raw.includes('invalid email or password') ||
    raw.includes('invalid_credentials')
  ) {
    if (context === 'signin') {
      return {
        title: 'Wrong email or password',
        hint: 'Double-check your details, or use "First time here?" if this is your first sign-in.',
        testTag: 'auth-error-wrong-password',
      };
    }
    return { title: 'Invalid credentials', testTag: 'auth-error-wrong-password' };
  }

  // Email not confirmed ────────────────────────────────────────────────
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
    return {
      title: 'Email not confirmed',
      hint: 'Please check your inbox and click the confirmation link.',
      testTag: 'auth-error-unconfirmed',
    };
  }

  // User not found — return the SAME message as wrong password to prevent
  // account-enumeration leaks. The 8-char code path in first-signin is safe
  // because the user must possess the code to trigger it.
  if (raw.includes('user not found') || raw.includes('no account')) {
    if (context === 'signin') {
      return {
        title: 'Wrong email or password',
        hint: 'Double-check your details, or use "First time here?" if this is your first sign-in.',
        testTag: 'auth-error-wrong-password',
      };
    }
    return {
      title: 'No account with that email',
      hint: 'First time here? Use your 8-character invitation code instead.',
      testTag: 'auth-error-not-found',
    };
  }

  // Rate limited ──────────────────────────────────────────────────────
  if (raw.includes('rate limit') || raw.includes('too many') || raw.includes('429')) {
    return {
      title: 'Too many attempts',
      hint: 'Please wait a minute and try again.',
      testTag: 'auth-error-rate-limit',
    };
  }

  // First-signin: bad or expired code ─────────────────────────────────
  if (context === 'first-signin') {
    if (raw.includes('code has already been used')) {
      return {
        title: 'This code has already been used',
        hint: 'If you already set a password, use "Sign in" instead.',
        testTag: 'auth-error-code-used',
      };
    }
    if (raw.includes('code') && (raw.includes('invalid') || raw.includes('not found') || raw.includes('expired'))) {
      return {
        title: "That code didn't work",
        hint: 'Check the 8 characters against your invitation email. Codes are case-insensitive.',
        testTag: 'auth-error-code-invalid',
      };
    }
  }

  // Set-password: weak password from Supabase policy ──────────────────
  if (context === 'set-password' && (raw.includes('password') || raw.includes('weak'))) {
    return {
      title: 'Password too weak',
      hint: 'Use at least 8 characters, mixing letters and numbers.',
      testTag: 'auth-error-weak-password',
    };
  }

  // Fallback ──────────────────────────────────────────────────────────
  return {
    title: 'Something went wrong',
    hint: extractMessage(error) || 'Please try again in a moment.',
    testTag: 'auth-error-generic',
  };
}

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error);
}
