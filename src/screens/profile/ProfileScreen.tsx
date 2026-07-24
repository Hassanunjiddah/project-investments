import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
import { ProfileSecurityCard } from '@/src/components/profile/ProfileSecurityCard';
import { ROLE_LABELS } from '@/src/constants/roles';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { routes } from '@/src/constants/routes';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
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
    <ScreenLayout hideThemeToggle>
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

      <Card style={styles.card}>
        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Appearance</Text>
        <View style={styles.themeRow}>
          <ThemeOption
            active={scheme === 'light'}
            palette={palette}
            icon="sun"
            label="Light"
            onPress={() => setTheme('light')}
            testId="theme-option-light"
          />
          <ThemeOption
            active={scheme === 'dark'}
            palette={palette}
            icon="moon"
            label="Dark"
            onPress={() => setTheme('dark')}
            testId="theme-option-dark"
          />
        </View>
      </Card>

      <ProfileSecurityCard />

      <Button
        title="Sign Out"
        variant="danger"
        loading={signOut.isPending}
        onPress={handleSignOut}
        style={styles.signOut}
        data-testid="signout-btn"
      />
    </ScreenLayout>
  );
}

type ThemeOptionProps = {
  active: boolean;
  palette: (typeof colors)['light'];
  icon: 'sun' | 'moon';
  label: string;
  onPress: () => void;
  testId: string;
};

function ThemeOption({ active, palette, icon, label, onPress, testId }: ThemeOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testId}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.themeOption,
        {
          backgroundColor: active ? palette.primaryLight : palette.surface,
          borderColor: active ? palette.primary : palette.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={active ? palette.primary : palette.text} />
      <Text
        style={[
          styles.themeOptionLabel,
          { color: active ? palette.primary : palette.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeOptionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
