// Client-side sign-in attempt limiter. Applies additional friction after too
// many failed attempts within a window — server-side rate limiting is still
// the source of truth, this is UX polish + defense in depth.

const STORAGE_KEY = 'prism.signIn.attempts';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

type State = { failCount: number; firstFailAt: number; cooldownUntil?: number };

function read(): State {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { failCount: 0, firstFailAt: 0 };
  }
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') ?? {
      failCount: 0,
      firstFailAt: 0,
    };
  } catch {
    return { failCount: 0, firstFailAt: 0 };
  }
}

function write(s: State) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export type CooldownStatus = {
  cooling: boolean;
  secondsLeft: number;
  attemptsRemaining: number;
};

export function checkSignInCooldown(): CooldownStatus {
  const s = read();
  const now = Date.now();

  if (s.cooldownUntil && s.cooldownUntil > now) {
    return {
      cooling: true,
      secondsLeft: Math.ceil((s.cooldownUntil - now) / 1000),
      attemptsRemaining: 0,
    };
  }

  // Window expired → reset counters.
  if (s.firstFailAt && now - s.firstFailAt > WINDOW_MS) {
    write({ failCount: 0, firstFailAt: 0 });
    return { cooling: false, secondsLeft: 0, attemptsRemaining: MAX_ATTEMPTS };
  }

  return {
    cooling: false,
    secondsLeft: 0,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - s.failCount),
  };
}

export function recordSignInFailure(): CooldownStatus {
  const s = read();
  const now = Date.now();
  const failCount = s.failCount + 1;
  const firstFailAt = s.firstFailAt || now;

  if (failCount >= MAX_ATTEMPTS) {
    const cooldownUntil = now + COOLDOWN_MS;
    write({ failCount: 0, firstFailAt: 0, cooldownUntil });
    return {
      cooling: true,
      secondsLeft: Math.ceil(COOLDOWN_MS / 1000),
      attemptsRemaining: 0,
    };
  }
  write({ failCount, firstFailAt });
  return {
    cooling: false,
    secondsLeft: 0,
    attemptsRemaining: MAX_ATTEMPTS - failCount,
  };
}

export function recordSignInSuccess(): void {
  write({ failCount: 0, firstFailAt: 0 });
}
