import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { WebFlexFill } from '@/src/components/nav/WebFlexFill';

/**
 * Web tab scenes stay mounted after first visit (lazy: true, detach false) so
 * RN-screens blanking does not wipe Projects. Unfocused scenes must not paint
 * or intercept clicks — otherwise /project-create and Projects sit on top of
 * Profile/Approvals.
 */
export function FocusedFill({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const scheme = useUiStore((s) => s.theme);
  const backgroundColor = colors[scheme].background;

  if (Platform.OS !== 'web') {
    return <View style={styles.fill}>{children}</View>;
  }
  return (
    <WebFlexFill label="scene" hidden={!focused} backgroundColor={backgroundColor}>
      {children}
    </WebFlexFill>
  );
}

export function TabSlotLayout() {
  return (
    <FocusedFill>
      <Slot />
    </FocusedFill>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
});
