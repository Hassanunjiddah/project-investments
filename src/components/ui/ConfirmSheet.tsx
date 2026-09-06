import { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';

type Detail = {
  label: string;
  value: string;
  /** If true, renders in monospace and larger — good for amounts / references. */
  emphasize?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;

  title: string;
  message?: string;

  /** Bullet-style list of amounts + parties. */
  details?: Detail[];

  /** Optional required-confirmation phrase the user must type verbatim
   *  (case-sensitive). If omitted, no typing gate — a checkbox is enough. */
  typedConfirmation?: string;

  /** Optional checkbox message; user must tick to proceed. If both this and
   *  `typedConfirmation` are set, both must be satisfied. */
  checkboxMessage?: string;

  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  'data-testid'?: string;
};

/**
 * Confirmation sheet for irreversible actions.
 *
 * Renders a centered dialog with:
 *   - title + optional message
 *   - "Details" block with amounts and parties (Money-style)
 *   - optional typed-phrase gate (e.g. type "END")
 *   - optional acknowledgement checkbox
 *   - Confirm + Cancel buttons
 *
 * `onConfirm` may be async — the button shows a spinner while pending.
 */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  details,
  typedConfirmation,
  checkboxMessage,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const testId = props['data-testid'];

  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped('');
      setChecked(false);
      setBusy(false);
    }
  }, [open]);

  const typedOk = !typedConfirmation || typed === typedConfirmation;
  const checkboxOk = !checkboxMessage || checked;
  const canConfirm = typedOk && checkboxOk && !busy && !loading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss confirmation"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              ...elevation.lg,
            },
          ]}
          testID={testId}
          data-testid={testId}
        >
          <ScrollView contentContainerStyle={styles.sheetInner}>
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconTile,
                  {
                    backgroundColor: destructive
                      ? palette.semantic.danger.bg
                      : palette.semantic.warning.bg,
                  },
                ]}
              >
                <Feather
                  name={destructive ? 'alert-octagon' : 'alert-triangle'}
                  size={18}
                  color={destructive ? palette.semantic.danger.fg : palette.semantic.warning.fg}
                />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
                {message ? (
                  <Text style={[styles.msg, { color: palette.textSecondary }]}>{message}</Text>
                ) : null}
              </View>
            </View>

            {details && details.length ? (
              <View
                style={[
                  styles.details,
                  { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
                ]}
              >
                {details.map((d, i) => (
                  <View key={`${d.label}-${i}`} style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: palette.textSecondary }]}>
                      {d.label}
                    </Text>
                    <Text
                      style={[
                        d.emphasize ? styles.detailValueEm : styles.detailValue,
                        { color: palette.text },
                      ]}
                    >
                      {d.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {typedConfirmation ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.hint, { color: palette.textSecondary }]}>
                  Type <Text style={styles.mono}>{typedConfirmation}</Text> to confirm.
                </Text>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="characters"
                  data-testid={testId ? `${testId}-typed` : 'confirm-typed'}
                />
              </View>
            ) : null}

            {checkboxMessage ? (
              <Pressable
                onPress={() => setChecked((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                testID={testId ? `${testId}-checkbox` : undefined}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: checked ? palette.primary : palette.border,
                      backgroundColor: checked ? palette.primary : palette.surface,
                    },
                  ]}
                >
                  {checked ? <Feather name="check" size={12} color="#FFF" /> : null}
                </View>
                <Text style={[styles.checkboxLabel, { color: palette.text }]}>
                  {checkboxMessage}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <Button
                title={cancelLabel}
                variant="secondary"
                onPress={onClose}
                data-testid={testId ? `${testId}-cancel` : undefined}
                style={{ flex: 1 }}
              />
              <Button
                title={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                onPress={handleConfirm}
                loading={busy || loading}
                disabled={!canConfirm}
                data-testid={testId ? `${testId}-confirm` : undefined}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radii.sheet,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetInner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  title: {
    fontFamily: typography.families.display,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  msg: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  details: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.sm + 4,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabel: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    // @ts-expect-error web-only
    fontVariantNumeric: 'tabular-nums',
  },
  detailValueEm: {
    fontFamily: typography.families.mono,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    fontVariantNumeric: 'tabular-nums',
  },
  hint: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
  },
  mono: {
    fontFamily: typography.families.mono,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
