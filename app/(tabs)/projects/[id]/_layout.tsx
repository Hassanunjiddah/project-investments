import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

/** Plain outlet — no second navigator under /projects/[id]. */
export default function ProjectIdLayout() {
  return (
    <View style={styles.fill}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', minHeight: 0 },
});
