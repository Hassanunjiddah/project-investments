import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/src/constants/site';

const OG_IMAGE = `${SITE_URL}/images/og-image.png`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{SITE_NAME}</title>
        <meta name="description" content={`${SITE_DESCRIPTION}. ${SITE_TAGLINE}`} />
        <meta property="og:title" content={SITE_NAME} />
        <meta property="og:description" content={`${SITE_DESCRIPTION}. ${SITE_TAGLINE}`} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_NAME} />
        <meta name="twitter:description" content={`${SITE_DESCRIPTION}. ${SITE_TAGLINE}`} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="theme-color" content="#064F92" />

        {/* Prism Capital design system fonts — Instrument Serif (display,
            editorial), Inter (UI), JetBrains Mono (references). Fraunces
            kept as a compat fallback while legacy screens migrate. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />

        {/* Global CSS: reduce-motion respect + tabular-nums default utility.
            Kept minimal — everything else is token-driven per component. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root { color-scheme: light dark; }
              html, body, #root { height: 100%; }
              body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
              /* Focus visibility — keyboard users only. */
              :focus:not(:focus-visible) { outline: none; }
              @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }
              /* Tabular nums utility for any raw HTML tables. */
              .tabular-nums { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1; }

              /* Live-signal pulse for the Activity pill dot (Phase C+). */
              @keyframes pill-live-pulse {
                0%   { transform: scale(1);   opacity: 1; }
                50%  { transform: scale(1.35); opacity: 0.5; }
                100% { transform: scale(1);   opacity: 1; }
              }
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
