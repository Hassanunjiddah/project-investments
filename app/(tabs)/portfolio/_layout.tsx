import { Slot } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

export default function PortfolioLayout() {
  return (
    <View style={[styles.fill, Platform.OS === 'web' ? styles.webFill : null]}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
  webFill: {
    // @ts-expect-error web CSS lengths
    minHeight: '100%',
    // @ts-expect-error web CSS lengths
    height: '100%',
  },
});
