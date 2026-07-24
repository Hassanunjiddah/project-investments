import { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Button } from '@/src/components/ui/Button';

type Props = {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onSignOut: () => void;
};

/**
 * 60-second countdown modal shown when the user is idle. If they hit "Stay
 * signed in" the idle-timeout hook resets. If they hit "Sign out now" — or
 * ignore it for 60s — the caller expires the session and redirects.
 */
export function SessionExpiredModal({ open, secondsLeft, onStay, onSignOut }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [display, setDisplay] = useState(secondsLeft);

  useEffect(() => setDisplay(secondsLeft), [secondsLeft]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              ...elevation.lg,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View style={[styles.iconTile, { backgroundColor: palette.semantic.warning.bg }]}>
            <Feather name="clock" size={22} color={palette.semantic.warning.fg} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>Are you still there?</Text>
          <Text style={[styles.msg, { color: palette.textSecondary }]}>
            You'll be signed out in{' '}
            <Text style={[styles.count, { color: palette.text }]}>{display}s</Text> for security.
          </Text>
          <View style={styles.actions}>
            <Button title="Sign out now" variant="secondary" onPress={onSignOut} style={{ flex: 1 }} />
            <Button title="Stay signed in" onPress={onStay} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.families.display,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  msg: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  count: {
    fontFamily: typography.families.mono,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
  },
});
