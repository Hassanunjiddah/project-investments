import { View, Text, Image, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';

type Props = {
  name: string;
  imageUrl?: string;
  size?: number;
};

export function Avatar({ name, imageUrl, size = 64 }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.primaryLight,
        },
      ]}
    >
      <Text style={[styles.initials, { color: palette.primary, fontSize: size * 0.35 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: typography.weights.bold,
  },
});
