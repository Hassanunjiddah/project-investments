// Prism Capital design tokens — colors (Jul 2026 blue rebrand).
//
// The RibhShare green era is over. Prism Capital now runs on the four-blue
// institutional palette provided by the user:
//   • #064f92  primary navy      (buttons, active states, chart lines)
//   • #6e82b4  dusty mid blue    (info, links, secondary emphasis)
//   • #b9c0db  soft lavender     (surface tints, chip idle states)
//   • #9a9b9d  warm grey         (muted text, dividers)
//
// Every legacy key (`primary`, `text`, `surface`, `success`, …) is
// preserved with its previous meaning so downstream code compiles without
// churn — only the HEXES change under the hood.
//
// New capabilities
// ────────────────
// • `colors[scheme].brand.50 … 900`      — 10-step ramp anchored at #064f92
// • `colors[scheme].ink.0 … 900`         — warm greys (never pure black/white)
// • `colors[scheme].accent.400/500/600`  — dusty blue accents for links/chips
// • `colors[scheme].semantic.<sem>.bg/fg/border` — WCAG-AA verified pairs
// • `colors[scheme].focusRing`           — 3-layer focus ring on primary
//
// Rules of use
// ────────────
// – DO NOT use `#hex` in components; pull from tokens.
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

type AccentScale = { 400: string; 500: string; 600: string };

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
  accent2: AccentScale; // dusty blue accent (#6e82b4)
  // Kept the legacy `gold` alias pointing at accent2 so anywhere that
  // still imports `palette.gold` keeps compiling; the visuals shift to
  // dusty blue rather than gold. Explicit rename planned in Phase B.
  gold: AccentScale;
  semantic: SemanticBlock;
  focusRing: FocusRing;
};

// ── LIGHT ──────────────────────────────────────────────────────────────
// Primary blue ramp anchored at #064f92 (700). Generated so 50-300 are
// tinted enough for surface washes while 800/900 stay useful for text on
// pale backgrounds.
const lightBrand: BrandScale = {
  50:  '#EDF5FC',
  100: '#D6E6F7',
  200: '#B3D2F0',
  300: '#85B6E6',
  400: '#5396D9',
  500: '#317ACA',
  600: '#215FA8',
  700: '#064F92', // anchor — user-specified brand primary
  800: '#153C70',
  900: '#13335E',
};

// Warm neutrals anchored at #9A9B9D (500). Never pure black/white so
// prints and PDFs stay soft.
const lightInk: InkScale = {
  0:   '#FFFFFF',
  50:  '#F8F8F9',
  100: '#F1F1F2',
  200: '#E3E4E5',
  300: '#CCCDD0',
  400: '#ABAEB2',
  500: '#9A9B9D', // user-specified neutral accent
  600: '#6B6C70',
  700: '#4E4F53',
  800: '#333438',
  900: '#17181A',
};

// Dusty blue accent (#6e82b4) — for links, chip idle states, secondary
// emphasis. Deliberately muted so it never fights the primary navy.
const lightAccent: AccentScale = {
  400: '#8B9CC3', // lighter dust
  500: '#6E82B4', // user-specified secondary
  600: '#556B9E', // deeper dust for hover states
};

// AA-verified pairs on WHITE surfaces (light theme).
const lightSemantic: SemanticBlock = {
  // Mint green that survives the blue-heavy environment — reads as
  // "positive/growth" without competing with navy primary.
  success: { bg: '#E6F8EC', fg: '#0F5B2D', border: '#B6DBC1' },
  warning: { bg: '#FEF2D7', fg: '#7A5300', border: '#EED28A' },
  // Warm coral — softer than fire red, still unambiguous.
  danger:  { bg: '#FDECEC', fg: '#8A1D1D', border: '#F1B7B7' },
  // Info pulls from the accent (dusty blue) so semantic-info harmonises
  // with the brand rather than fighting it.
  info:    { bg: '#EDF1FA', fg: '#2A3F6E', border: '#B9C0DB' },
};

// ── DARK ───────────────────────────────────────────────────────────────
// Deep navy background scheme. Primary stays vibrant on dark by shifting
// to the 400 step for CTAs (still readable, high-contrast).
const darkBrand: BrandScale = {
  50:  '#0A1626',
  100: '#0F1F36',
  200: '#152A48',
  300: '#1E3861',
  400: '#2B4E85',
  500: '#4270B4',
  600: '#5B90D6', // primary CTA color on dark
  700: '#85B0E6',
  800: '#B4D0F0',
  900: '#DCEAF9',
};

const darkInk: InkScale = {
  0:   '#0A0B0D',
  50:  '#101114',
  100: '#141519',
  200: '#1D1F24',
  300: '#2A2C32',
  400: '#3E4048',
  500: '#6C6E75',
  600: '#9497A0',
  700: '#BFC1C7',
  800: '#DFE0E3',
  900: '#F5F5F7',
};

const darkAccent: AccentScale = {
  400: '#A3B4D6',
  500: '#B9C0DB', // matches user tertiary — glows nicely on navy
  600: '#8B9CC3',
};

// AA-verified pairs on dark navy surfaces.
const darkSemantic: SemanticBlock = {
  success: { bg: '#0D2419', fg: '#8BE1A3', border: '#1E4A34' },
  warning: { bg: '#2E2411', fg: '#F0CE7B', border: '#4A3A18' },
  danger:  { bg: '#2E1919', fg: '#F0A2A2', border: '#4A2828' },
  info:    { bg: '#132747', fg: '#B9C0DB', border: '#2A3F6E' },
};

const lightFocus: FocusRing = {
  ring: lightAccent[500],
  halo: 'rgba(110, 130, 180, 0.28)',
  contrast: '#000000',
};

const darkFocus: FocusRing = {
  ring: darkAccent[500],
  halo: 'rgba(185, 192, 219, 0.35)',
  contrast: '#FFFFFF',
};

// ── EXPORT ─────────────────────────────────────────────────────────────
export const colors: Record<'light' | 'dark', Palette> = {
  light: {
    // legacy (unchanged shape, new values)
    background: lightInk[50],
    surface: lightInk[0],
    surfaceMuted: lightInk[100],
    text: lightInk[900],
    textSecondary: lightInk[600],
    primary: lightBrand[700],
    primaryHover: lightBrand[800],
    primaryLight: lightBrand[50],
    accent: lightAccent[500],
    accentLight: lightAccent[400],
    border: lightInk[200],
    error: lightSemantic.danger.fg,
    errorLight: lightSemantic.danger.bg,
    success: lightSemantic.success.fg,
    warning: lightSemantic.warning.fg,
    warningLight: lightSemantic.warning.bg,
    info: lightAccent[500],
    infoLight: lightSemantic.info.bg,
    muted: lightInk[500],
    surfaceRgb: '255, 255, 255',
    primaryRgb: '6, 79, 146',

    // new
    brand: lightBrand,
    ink: lightInk,
    accent2: lightAccent,
    gold: lightAccent, // legacy alias — see note above
    semantic: lightSemantic,
    focusRing: lightFocus,
  },
  dark: {
    // legacy (unchanged shape, new values)
    background: darkInk[0],
    surface: darkInk[100],
    surfaceMuted: darkInk[200],
    text: darkInk[900],
    textSecondary: darkInk[700],
    primary: darkBrand[600],
    primaryHover: darkBrand[500],
    primaryLight: darkBrand[100],
    accent: darkAccent[500],
    accentLight: darkAccent[400],
    border: darkInk[300],
    error: darkSemantic.danger.fg,
    errorLight: darkSemantic.danger.bg,
    success: darkSemantic.success.fg,
    warning: darkSemantic.warning.fg,
    warningLight: darkSemantic.warning.bg,
    info: darkAccent[500],
    infoLight: darkSemantic.info.bg,
    muted: darkInk[500],
    surfaceRgb: '20, 21, 25',
    primaryRgb: '91, 144, 214',

    // new
    brand: darkBrand,
    ink: darkInk,
    accent2: darkAccent,
    gold: darkAccent, // legacy alias
    semantic: darkSemantic,
    focusRing: darkFocus,
  },
};

export type ColorScheme = keyof typeof colors;
