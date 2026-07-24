// Prism Capital design tokens — spacing, radii, elevation, motion.
//
// Backwards-compatible: `spacing`, `radii`, and `elevation` keep their
// existing keys/values so downstream code compiles. New fields are added.

// ── SPACING (4px base — unchanged legacy plus finer steps) ─────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // new steps
  x3s: 2,
  x2s: 6,   // between xs and sm
  x2l: 40,  // between xl and xxl
  x3l: 64,
} as const;

// ── RADII (legacy keys + surface-scale semantics) ──────────────────────
export const radii = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  // semantic aliases used by new components
  button: 12,   // pill vibe but with corners
  input: 12,
  chip: 999,
  card: 16,
  sheet: 24,
} as const;

// ── ELEVATION — light mode ────────────────────────────────────────────
// Light mode uses subtle shadows; dark mode uses a *lighter surface* +
// tinted border for depth rather than shadows (per Feb-2026 spec).
export const elevation = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

// Dark-mode depth uses lighter surfaces + tinted borders. Consumers can
// spread this in addition to `elevation.*` when `scheme === 'dark'` — the
// zero shadow overrides the light-mode shadow to keep dark surfaces flat.
export const darkElevation = {
  sm: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    // Slightly lighter surface tint applied via `backgroundColor` override
    // on the consuming component (see Card refresh).
  },
  md: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  lg: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;

// ── MOTION ─────────────────────────────────────────────────────────────
export const motion = {
  duration: {
    fast: 120,
    std: 180,
    slow: 260,
    hero: 420,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

/**
 * `true` when the user prefers reduced motion. Web only — native returns
 * `false` (native components already respect reduce-motion at the OS
 * level for standard animations).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
