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
              html, body { margin: 0; padding: 0; }
              html, body, #root {
                min-height: 100vh;
                min-height: 100dvh;
              }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                -webkit-tap-highlight-color: transparent;
                -webkit-text-size-adjust: 100%;
                overscroll-behavior-y: none;
                touch-action: manipulation;
                background: #F4F6F8;
              }
              @media (prefers-color-scheme: dark) {
                body { background: #0B1220; }
              }
              /* Instant branded shell before JS hydrates — kills white blank flash. */
              #prism-boot {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 14px;
                background: #F4F6F8;
                color: #0B1220;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                transition: opacity 220ms ease;
              }
              @media (prefers-color-scheme: dark) {
                #prism-boot { background: #0B1220; color: #F4F6F8; }
              }
              #prism-boot.prism-boot-hide {
                opacity: 0;
                pointer-events: none;
              }
              #prism-boot .prism-boot-mark {
                width: 56px;
                height: 56px;
                border-radius: 12px;
                object-fit: contain;
                display: block;
              }
              #prism-boot .prism-boot-brand {
                font-family: 'Instrument Serif', Georgia, serif;
                font-size: 22px;
                letter-spacing: -0.3px;
              }
              #prism-boot .prism-boot-msg {
                font-size: 13px;
                opacity: 0.65;
                font-weight: 500;
              }
              @media (prefers-reduced-motion: reduce) {
                #prism-boot .prism-boot-mark { opacity: 1; }
              }
              [class*="css-view-"] > [style*="overflow"]:not([style*="overflow: hidden"]),
              [data-rn-scrollview],
              .rn-scroll {
                -webkit-overflow-scrolling: touch;
              }
              :focus:not(:focus-visible) { outline: none; }
              @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }
              .tabular-nums { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1; }
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
      <body>
        <div id="prism-boot" aria-live="polite" aria-busy="true">
          <img
            className="prism-boot-mark"
            src="/images/prism-logo-512.png"
            width={56}
            height={56}
            alt=""
            aria-hidden="true"
          />
          <div className="prism-boot-brand">{SITE_NAME}</div>
          <div className="prism-boot-msg">Loading…</div>
        </div>
        {children}
      </body>
    </html>
  );
}
