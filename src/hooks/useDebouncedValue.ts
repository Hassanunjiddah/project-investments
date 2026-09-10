import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has been stable for `delayMs`. Keeps typing
 * responsive by letting the input update instantly while filtering /
 * searching runs against the debounced copy.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
