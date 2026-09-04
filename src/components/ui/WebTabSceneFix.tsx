import { useEffect } from 'react';
import { Platform } from 'react-native';

const STYLE_ID = 'prism-web-tab-scene-fix';

/**
 * Expo `+html.tsx` is not applied to `expo export --platform web` with
 * `web.output: 'single'` in this project — production HTML is the bare
 * template. Inject the web tab-scene CSS from JS instead so inactive tabs
 * cannot paint through when react-native-screens is off.
 */
export function WebTabSceneFix() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html, body, #root {
        height: 100%;
        min-height: 100%;
      }
      #root {
        display: flex;
        flex-direction: column;
      }
      /* Inactive tab scenes without native screens */
      [aria-hidden="true"][style*="position: absolute"],
      [aria-hidden="true"][style*="position:absolute"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}
