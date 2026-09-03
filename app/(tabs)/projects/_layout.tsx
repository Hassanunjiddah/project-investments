import { Stack } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

export default function ProjectsLayout() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Critical on web — without flex the create/detail scenes paint blank.
        contentStyle: { flex: 1, backgroundColor: palette.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
