import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/store/useAuthStore';
import { formatNaira } from '@/src/utils/currency';
import { StageBadge } from '@/src/components/ui/StageBadge';

type OwnerProject = {
  id: string;
  code: string;
  name: string;
  stage: string;
  target_minor: number;
  raised_minor: number;
};

export default function OwnerHomeScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const userId = useAuthStore((s) => s.session?.user?.id);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['owner-projects', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, code, name, stage, target_minor, raised_minor')
        .eq('project_owner_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OwnerProject[];
    },
  });

  return (
    <ScreenLayout>
      <Text style={[styles.heading, { color: palette.text }]}>Your projects</Text>
      <Text style={[styles.sub, { color: palette.textSecondary }]}>
        As project owner you request drawdowns from Prism and propose profit declarations. Prism
        (Line Manager) runs invites, payments, and investor visibility.
      </Text>

      {isLoading ? (
        <Text style={{ color: palette.muted }}>Loading…</Text>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <Text style={{ color: palette.muted }}>
              No projects assigned yet. Prism will link you when your deal is onboarded.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(tabs)/projects/${item.id}` as never)}
              style={[
                styles.card,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
            >
              <View style={styles.top}>
                <Text style={[styles.code, { color: palette.muted }]}>{item.code}</Text>
                <StageBadge stage={item.stage as never} />
              </View>
              <Text style={[styles.name, { color: palette.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                Raised {formatNaira(item.raised_minor)} of {formatNaira(item.target_minor)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sub: { fontSize: typography.sizes.sm, lineHeight: 20, marginBottom: spacing.lg },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontFamily: 'monospace', fontSize: typography.sizes.xs },
  name: { fontSize: typography.sizes.md, fontWeight: '600' },
  meta: { fontSize: typography.sizes.xs },
});
