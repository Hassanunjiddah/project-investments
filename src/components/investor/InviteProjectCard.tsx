import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { Badge } from '@/src/components/ui/Badge';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import {
  INVITE_STATUS_LABELS,
  INVESTED_INVITE_STATUSES,
  type Invite,
} from '@/src/types/invitation.types';

type Props = {
  invite: Invite;
  onPress?: () => void;
};

export function InviteProjectCard({ invite, onPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const invested = INVESTED_INVITE_STATUSES.includes(invite.status);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
    >
      {invite.projectBannerUrl ? (
        <Image source={{ uri: invite.projectBannerUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: palette.primaryLight }]}>
          <Ionicons name="image-outline" size={22} color={palette.primary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {invite.projectName ?? 'Project'}
          </Text>
          <Badge label={INVITE_STATUS_LABELS[invite.status]} variant="accent" />
        </View>
        {invite.projectSector ? (
          <Text style={[styles.sector, { color: palette.textSecondary }]}>{invite.projectSector}</Text>
        ) : null}
        {invested && invite.amountMinor != null ? (
          <Text style={[styles.amount, { color: palette.text }]}>
            Invested: {formatNaira(invite.amountMinor)}
          </Text>
        ) : invite.minUnits != null ? (
          <Text style={[styles.amountMuted, { color: palette.muted }]}>
            Min: {invite.minUnits} unit{invite.minUnits === 1 ? '' : 's'}
          </Text>
        ) : invite.maxInvestmentAmountMinor != null ? (
          <Text style={[styles.amountMuted, { color: palette.muted }]}>
            Max: {formatNaira(invite.maxInvestmentAmountMinor)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  sector: { fontSize: typography.sizes.xs, marginTop: 2, marginBottom: spacing.xs },
  amount: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  amountMuted: { fontSize: typography.sizes.xs, marginTop: spacing.xs },
});
