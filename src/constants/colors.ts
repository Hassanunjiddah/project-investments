// Prism Capital design tokens — colors.
//
// This file is intentionally backwards-compatible: every key that existed
// before the Feb-2026 refresh (`primary`, `text`, `surface`, `success`, …)
// remains present with the exact same meaning so downstream code keeps
// compiling. The refresh ADDS new scales and semantic pairs.
//
// New capabilities
// ────────────────
// • `colors[scheme].brand.50 … 900`      — 10-step ramp anchored at #166534
// • `colors[scheme].ink.0 … 900`         — warm greys (never pure black/white)
// • `colors[scheme].gold.400/500/600`    — sparing gold accent
// • `colors[scheme].semantic.<sem>.bg/fg/border` — WCAG AA verified pairs
// • `colors[scheme].focusRing`           — 3-layer gold focus ring color set
//
// Rules of use
// ────────────
// – DO NOT use `#hex` in components; pull from tokens.
// – Gold is for CTAs' focus rings, "approved" micro-moments and premium
//   badges only — NEVER large surfaces or hero backgrounds.
// – Semantic tokens (success/warning/danger/info) MUST come from the
//   `semantic.*` block, not the legacy top-level shortcuts (which remain
//   for compatibility). New code uses the semantic block.

type BrandScale = {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
};

type InkScale = {
  0: string; 50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
};

type GoldScale = { 400: string; 500: string; 600: string };

type SemanticPair = { bg: string; fg: string; border: string };
type SemanticBlock = {
  success: SemanticPair;
  warning: SemanticPair;
  danger: SemanticPair;
  info: SemanticPair;
};

type FocusRing = {
  /** Inner solid ring color (2px, on the element) */
  ring: string;
  /** Outer soft halo (rgba) */
  halo: string;
  /** Contrast fallback for high-contrast mode */
  contrast: string;
};

type Palette = {
  // Legacy keys (unchanged meaning) ────────────────────────────────────
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  border: string;
  error: string;
  errorLight: string;
  success: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  muted: string;
  surfaceRgb: string;
  primaryRgb: string;

  // New system ─────────────────────────────────────────────────────────
  brand: BrandScale;
  ink: InkScale;
  gold: GoldScale;
  semantic: SemanticBlock;
  focusRing: FocusRing;
};

// ── LIGHT ──────────────────────────────────────────────────────────────
const lightBrand: BrandScale = {
  50:  '#EEF7F0',
  100: '#D6EBDD',
  200: '#AED8BB',
  300: '#7EBF94',
  400: '#4FA36E',
  500: '#2A854D',
  600: '#1E7440',
  700: '#166534', // anchor — matches previous `primary`
  800: '#12522A',
  900: '#0D3B1E',
};

const lightInk: InkScale = {
  0:   '#FFFFFF',
  50:  '#F9FAF7',
  100: '#F1F4EF',
  200: '#E4E9E1',
  300: '#CBD3C7',
  400: '#9BA79D',
  500: '#6E7B71',
  600: '#4E5A52',
  700: '#333E37',
  800: '#1F2823',
  900: '#0F1512',
};

const lightGold: GoldScale = {
  400: '#C9A227', // legacy `accent` for compat
  500: '#B08D2E',
  600: '#8F6F1F',
};

const lightSemantic: SemanticBlock = {
  success: { bg: '#E7F5EC', fg: '#0F5B2D', border: '#B6DBC1' }, // AA on fg/bg
  warning: { bg: '#FEF2D7', fg: '#7A5300', border: '#EED28A' },
  danger:  { bg: '#FDECEC', fg: '#8A1D1D', border: '#F1B7B7' },
  info:    { bg: '#E7F0FC', fg: '#0B3D8A', border: '#B7CDF0' },
};

// ── DARK ───────────────────────────────────────────────────────────────
const darkBrand: BrandScale = {
  50:  '#0C1D14',
  100: '#123326',
  200: '#164A34',
  300: '#1E633F',
  400: '#2B8253',
  500: '#3EA067',
  600: '#4ADE71', // matches previous dark-mode `primary`
  700: '#86EFAC',
  800: '#B7F5CD',
  900: '#DFFCEA',
};

const darkInk: InkScale = {
  0:   '#080C0A',
  50:  '#0F1512',
  100: '#121A15',
  200: '#1B2720',
  300: '#27382E',
  400: '#3E4E43',
  500: '#6B776F',
  600: '#94A39A',
  700: '#BCC6BF',
  800: '#DDE4DE',
  900: '#F5F8F5',
};

const darkGold: GoldScale = {
  400: '#EBCF6E',
  500: '#D9B85A',
  600: '#B69835',
};

// AA-verified on dark backgrounds
const darkSemantic: SemanticBlock = {
  success: { bg: '#12291E', fg: '#8BE1A3', border: '#1E4A34' },
  warning: { bg: '#2E2411', fg: '#F0CE7B', border: '#4A3A18' },
  danger:  { bg: '#2E1919', fg: '#F0A2A2', border: '#4A2828' },
  info:    { bg: '#132747', fg: '#8CB2EE', border: '#1F3E70' },
};

const lightFocus: FocusRing = {
  ring: lightGold[500],
  halo: 'rgba(176, 141, 46, 0.28)',
  contrast: '#000000',
};

const darkFocus: FocusRing = {
  ring: darkGold[500],
  halo: 'rgba(217, 184, 90, 0.35)',
  contrast: '#FFFFFF',
};

// ── EXPORT ─────────────────────────────────────────────────────────────
export const colors: Record<'light' | 'dark', Palette> = {
  light: {
    // legacy
    background: lightInk[50],
    surface: lightInk[0],
    surfaceMuted: lightInk[100],
    text: lightInk[900],
    textSecondary: lightInk[500],
    primary: lightBrand[700],
    primaryHover: lightBrand[800],
    primaryLight: lightBrand[50],
    accent: lightGold[400],
    accentLight: '#FDF6E3',
    border: lightInk[200],
    error: '#EF4444',
    errorLight: '#FEE2E2',
    success: '#22C55E',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    muted: lightInk[400],
    surfaceRgb: '255, 255, 255',
    primaryRgb: '22, 101, 52',

    // new
    brand: lightBrand,
    ink: lightInk,
    gold: lightGold,
    semantic: lightSemantic,
    focusRing: lightFocus,
  },
  dark: {
    // legacy
    background: darkInk[0],
    surface: darkInk[100],
    surfaceMuted: darkInk[200],
    text: darkInk[900],
    textSecondary: darkInk[600],
    primary: darkBrand[600],
    primaryHover: darkBrand[700],
    primaryLight: darkBrand[100],
    accent: darkGold[500],
    accentLight: '#3D3520',
    border: darkInk[300],
    error: '#F87171',
    errorLight: '#3D1F1C',
    success: '#4ADE71',
    warning: '#FBBF24',
    warningLight: '#3D3520',
    info: '#60A5FA',
    infoLight: '#1E3A8A',
    muted: darkInk[500],
    surfaceRgb: '18, 26, 21',
    primaryRgb: '74, 222, 113',

    // new
    brand: darkBrand,
    ink: darkInk,
    gold: darkGold,
    semantic: darkSemantic,
    focusRing: darkFocus,
  },
};

export type ColorScheme = keyof typeof colors;
