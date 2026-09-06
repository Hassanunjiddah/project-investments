import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function PortfolioProjectIdLayout() {
  return (
    <View style={styles.fill}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', minHeight: 0 },
});
