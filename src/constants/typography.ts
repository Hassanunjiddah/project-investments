// Type scale (Feb 2026 refresh) — tighter tracking on large sizes, tabular
// numerals used for money-adjacent components via a separate style prop.
export const typography = {
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
  // Line heights match the design blueprint scale.
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
} as const;
