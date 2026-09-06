// Prism Capital design tokens — typography.
//
// Backwards-compatible: legacy fields (`sizes`, `weights`, `letterSpacing`,
// `lineHeights`) are preserved with their existing shapes. New fields
// (`families`, `display`, `numeric`) are added alongside.
//
// Font strategy
// ─────────────
// • DISPLAY (headings, hero numbers)  → Fraunces variable serif, wghts 400-800,
//   with opsz axis 9-144 for hairline crispness. Falls back to Georgia.
// • UI (body, forms, inputs)          → Inter variable, weights 400-700.
//   Falls back to system-ui.
// • MONO (references, code, refs)     → JetBrains Mono variable. Falls back
//   to ui-monospace.
//
// Money handling
// ──────────────
// `numeric.tabular` is a style fragment to spread onto any <Text>
// containing a monetary or tabular figure. It enables the OpenType
// `tnum` feature so digit columns line up.

export const typography = {
  // ── LEGACY (unchanged) ──────────────────────────────────────────────
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    tight: -0.5,
    tighter: -0.8,
    normal: 0,
    wide: 0.6,
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },

  // ── NEW ─────────────────────────────────────────────────────────────

  /**
   * Font-family stacks. Web will honour these; native falls back to system.
   * Load Fraunces + Inter + JetBrains Mono via <link> in app/+html.tsx.
   */
  families: {
    // Prism Capital display face — Instrument Serif (editorial serif) with
    // Fraunces / Georgia as graceful fallbacks so existing screens keep
    // rendering during rollout. Web loads Instrument Serif via +html.tsx.
    display:
      '"Instrument Serif", "Fraunces", "Fraunces Fallback", Georgia, "Times New Roman", serif',
    ui:
      '"Inter", "Inter Fallback", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono:
      '"JetBrains Mono", "JetBrains Mono Fallback", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },

  /**
   * Display type presets — Fraunces at hero and headline sizes with
   * distinctive tight tracking. Use for section H1, hero metrics and
   * money "Your share" blocks.
   */
  display: {
    xs:   { fontFamily: undefined as string | undefined, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: '600' as const },
    sm:   { fontSize: 24, lineHeight: 30, letterSpacing: -0.3, fontWeight: '600' as const },
    md:   { fontSize: 32, lineHeight: 38, letterSpacing: -0.5, fontWeight: '600' as const },
    lg:   { fontSize: 44, lineHeight: 50, letterSpacing: -0.9, fontWeight: '600' as const },
    xl:   { fontSize: 56, lineHeight: 62, letterSpacing: -1.1, fontWeight: '600' as const },
    xxl:  { fontSize: 72, lineHeight: 78, letterSpacing: -1.4, fontWeight: '700' as const },
  },

  /**
   * Numeric styles. Spread on ANY <Text> containing a monetary figure or
   * tabular data. On web this activates OpenType tnum for column-perfect
   * digit alignment. On native the properties are no-ops but harmless.
   */
  numeric: {
    tabular: {
      fontVariantNumeric: 'tabular-nums lining-nums',
      fontFeatureSettings: '"tnum" 1, "lnum" 1',
    },
  },
} as const;

/** Convenience alias for the tabular-nums style fragment. */
export const tabularNums = typography.numeric.tabular;
