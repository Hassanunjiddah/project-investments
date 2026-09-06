import { useEffect } from 'react';
import { Platform } from 'react-native';

import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

/**
 * Lock the document to the viewport. Scrolling happens inside `WebFlexFill`
 * (a real HTML overflow:auto box). RN-web Views cannot do that job.
 */
const VIEWPORT_CSS = `
html, body, #root {
  width: 100% !important;
  height: 100% !important;
  height: 100dvh !important;
  margin: 0;
  overflow: hidden !important;
}
#root {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
#root, #root > div {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
`;

export function injectWebViewportCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'prism-viewport-fill';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = VIEWPORT_CSS;
}

export function WebDocumentBackground() {
  const scheme = useUiStore((s) => s.theme);
  const background = colors[scheme].background;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    injectWebViewportCss();
    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = background;
  }, [background]);

  return null;
}
