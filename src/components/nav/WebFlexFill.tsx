import type { CSSProperties, ReactNode } from 'react';
import { Platform, View } from 'react-native';

type Props = {
  children: ReactNode;
  /** If true, this box is the scrollport. If false, it fills and clips. */
  scroll?: boolean;
  backgroundColor?: string;
  style?: CSSProperties;
  hidden?: boolean;
  /** Debug identifier surfaced as data-prism in the DOM. */
  label?: string;
};

/**
 * Native HTML flex box for web. RN-web `View` defaults to overflow:hidden and
 * does not implement overflow:auto, so it can neither fill the tab scene nor
 * scroll. This element participates in a real CSS flex/height chain.
 */
export function WebFlexFill({
  children,
  scroll = false,
  backgroundColor,
  style,
  hidden = false,
  label,
}: Props) {
  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  }
  return (
    <div
      data-prism={label ?? (scroll ? 'scrollport' : 'fill')}
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        height: '100%',
        display: hidden ? 'none' : 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: scroll ? 'auto' : 'hidden',
        WebkitOverflowScrolling: scroll ? 'touch' : undefined,
        backgroundColor,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
