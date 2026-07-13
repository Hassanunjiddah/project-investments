import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { useSignOut } from '@/src/hooks/auth/useSignOut';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ROLE_LABELS } from '@/src/constants/roles';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { routes } from '@/src/constants/routes';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: profile, isLoading, isError, error, refetch } = useFetchProfile();
  const signOut = useSignOut();

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load profile"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (!profile) {
    return <EmptyState title="No profile found" message="Your profile could not be loaded." />;
  }

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    router.replace(routes.SIGN_IN);
  };

  return (
    <ScreenLayout>
      <Text style={[styles.heading, { color: palette.text }]}>Profile</Text>

      <Card style={styles.card}>
        <View style={styles.profileRow}>
          <Avatar name={profile.fullName} imageUrl={profile.avatarUrl} />
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: palette.text }]}>{profile.fullName}</Text>
            <Text style={[styles.email, { color: palette.textSecondary }]}>{profile.email}</Text>
            <Badge label={ROLE_LABELS[profile.role]} variant="accent" />
          </View>
        </View>
      </Card>

      <Button
        title="Sign Out"
        variant="danger"
        loading={signOut.isPending}
        onPress={handleSignOut}
        style={styles.signOut}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  email: {
    fontSize: typography.sizes.sm,
  },
  signOut: {
    marginTop: spacing.md,
  },
});
