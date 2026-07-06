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
        <meta name="theme-color" content="#1B6B3A" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
