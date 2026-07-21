// Refined color tokens per the design blueprint (Feb 2026 refresh).
// Deep, rich fintech greens for trust. Subtle green tint on dark backgrounds
// avoids pure black flatness. Every mode keeps the exact same key set so
// downstream code (`colors[scheme].xxx`) doesn't need to check for
// existence.
export const colors = {
  light: {
    background: '#F7F9F8',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F4F2',
    text: '#0F172A',
    textSecondary: '#64748B',
    primary: '#166534',
    primaryHover: '#14532D',
    primaryLight: '#DCFCE7',
    accent: '#C9A227',
    accentLight: '#FDF6E3',
    border: '#E2E8F0',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    success: '#22C55E',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    muted: '#94A3B8',
    // Alpha helpers for glass / press states — RGB channels of `surface`.
    surfaceRgb: '255, 255, 255',
    primaryRgb: '22, 101, 52',
  },
  dark: {
    background: '#080C0A',
    surface: '#121A15',
    surfaceMuted: '#1B2720',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#4ADE71',
    primaryHover: '#86EFAC',
    primaryLight: '#14532D',
    accent: '#FBBF24',
    accentLight: '#3D3520',
    border: '#27382E',
    error: '#F87171',
    errorLight: '#3D1F1C',
    success: '#4ADE71',
    warning: '#FBBF24',
    warningLight: '#3D3520',
    info: '#60A5FA',
    infoLight: '#1E3A8A',
    muted: '#64748B',
    surfaceRgb: '18, 26, 21',
    primaryRgb: '74, 222, 113',
  },
} as const;

export type ColorScheme = keyof typeof colors;
