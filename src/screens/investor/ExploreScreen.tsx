import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { CategoryChips } from '@/src/components/ui/CategoryChips';
import { ExploreProjectCard } from '@/src/components/investor/ExploreProjectCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { EXPLORE_SECTORS } from '@/db/selectors';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function ExploreScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All');
  const version = useMockDataStore((s) => s.version);
  const getExploreProjects = useMockDataStore((s) => s.getExploreProjects);

  void version;
  const projects = getExploreProjects({ query, sector });
  const topFunding = getExploreProjects()
    .sort((a, b) => b.raisedKobo / b.targetKobo - a.raisedKobo / a.targetKobo)
    .slice(0, 3);

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: palette.text }]}>Explore Projects</Text>
        <View
          style={[styles.searchRow, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Ionicons name="search-outline" size={16} color={palette.muted} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search projects, sectors, or keywords"
            placeholderTextColor={palette.muted}
            value={query}
            onChangeText={setQuery}
          />
          <Ionicons name="filter-outline" size={16} color={palette.text} />
        </View>

        <CategoryChips categories={EXPLORE_SECTORS} active={sector} onChange={setSector} />

        <SectionHeader title="New Opportunities" />
        {projects.map((item) => (
          <ExploreProjectCard
            key={item.id}
            project={item}
            onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
          />
        ))}

        <SectionHeader title="Top Funding Projects" />
        {topFunding.map((project) => (
          <ProjectProgressCard
            key={project.id}
            project={project}
            onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
          />
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    height: 40,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm },
});
