import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import moment from 'moment';

import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import { usePendingDeclarations } from '@/src/hooks/profits/useProfitDeclarations';

export function ApprovalsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const { data: pending = [], isLoading } = usePendingDeclarations();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
      data-testid="approvals-screen"
    >
      <Text style={[styles.h1, { color: palette.text }]}>Approvals queue</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Profit declarations awaiting your second signature. Four-eyes principle applies —
        submitters cannot approve their own declarations.
      </Text>

      {isLoading ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary, marginTop: spacing.md }]}>
          Loading…
        </Text>
      ) : pending.length === 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            title="No pending declarations"
            message="Line Managers' profit declarations show up here for your review."
          />
        </View>
      ) : (
        pending.map((d) => (
          <Pressable
            key={d.id}
            onPress={() =>
              router.push({
                pathname: '/projects/[id]',
                params: { id: d.projectId, tab: 'profits' },
              } as any)
            }
            style={[
              styles.row,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            data-testid={`approval-row-${d.reference}`}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.mono, { color: palette.primary }]}>{d.reference}</Text>
              {d.isFinal ? (
                <View style={[styles.finalChip, { backgroundColor: palette.primaryLight }]}>
                  <Text style={{ color: palette.primary, fontSize: typography.sizes.xs, fontWeight: '700' }}>
                    FINAL
                  </Text>
                </View>
              ) : null}
            </View>
            {d.label ? (
              <Text style={[styles.label, { color: palette.text }]}>{d.label}</Text>
            ) : null}
            <Text style={[styles.meta, { color: palette.textSecondary }]}>
              Gross {formatNaira(d.grossMinor)} · Net {formatNaira(d.netMinor)} · Investor pool{' '}
              {formatNaira(d.investorPoolMinor)} · {formatNaira(d.perUnitMinor)}/unit
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]}>
              Declared {moment(d.declaredAt).fromNow()}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: scrollBottomInset },
  h1: { fontSize: typography.sizes.xl, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, marginTop: 4 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  rowHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontWeight: '700', fontSize: typography.sizes.sm },
  finalChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  label: { fontSize: typography.sizes.md, fontWeight: '600' },
  meta: { fontSize: typography.sizes.xs },
});
