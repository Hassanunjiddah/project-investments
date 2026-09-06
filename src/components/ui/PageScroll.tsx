import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = ScrollViewProps & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Native: a real ScrollView. Web: a plain View so the window scrolls.
 * RN-web ScrollView preventDefault on wheel even when it cannot scroll.
 */
export function PageScroll({ children, style, contentContainerStyle, ...props }: Props) {
  if (Platform.OS === 'web') {
    return <View style={[{ width: '100%' }, style, contentContainerStyle]}>{children}</View>;
  }
  return (
    <ScrollView style={[{ flex: 1 }, style]} contentContainerStyle={contentContainerStyle} {...props}>
      {children}
    </ScrollView>
  );
}
