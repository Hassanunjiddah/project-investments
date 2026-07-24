// Prism Capital — theme barrel + semantic helpers.
//
// Re-exports everything from the constants so downstream code can do:
//   import { colors, spacing, typography, radii, motion } from '@/src/theme';
// Existing imports from '@/src/constants/*' still work.

export { colors } from '@/src/constants/colors';
export type { ColorScheme } from '@/src/constants/colors';
export { typography, tabularNums } from '@/src/constants/typography';
export {
  spacing,
  radii,
  elevation,
  darkElevation,
  motion,
  prefersReducedMotion,
} from '@/src/constants/spacing';
