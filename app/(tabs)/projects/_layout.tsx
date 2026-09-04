import { Slot } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

/**
 * No Stack under the Projects tab. Nested Stack + react-native-screens on
 * RN-web (Expo SDK 54) leaves the active scene with activityState 0 → blank
 * list/detail/create. Slot is a plain outlet with no native screen detach.
 */
export default function ProjectsLayout() {
  return (
    <View
      testID="projects-shell"
      style={[
        styles.fill,
        Platform.OS === 'web' ? styles.webFill : null,
      ]}
    >
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
  },
  webFill: {
    // @ts-expect-error web CSS lengths
    minHeight: '100%',
    // @ts-expect-error web CSS lengths
    height: '100%',
  },
});
