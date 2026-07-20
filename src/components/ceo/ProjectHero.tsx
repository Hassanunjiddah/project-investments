import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { spacing } from '@/src/constants/spacing';

type Props = {
  imageUrl: string;
  height?: number;
  badge?: ReactNode;
};

export function ProjectHero({ imageUrl, height = 180, badge }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { height, maxHeight: height }]}
        contentFit="cover"
      />
      {badge ? <View style={styles.badgeOverlay}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    borderRadius: 16,
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
});
