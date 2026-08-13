/**
 * Push a notification href reliably on Expo Router (especially web).
 * Query strings on raw path strings are often ignored — parse into params.
 */
export function navigateNotificationHref(
  router: { push: (href: never) => void },
  href: string,
): void {
  if (!href) {
    router.push('/(tabs)/notifications' as never);
    return;
  }

  const qIndex = href.indexOf('?');
  if (qIndex === -1) {
    router.push(href as never);
    return;
  }

  const pathname = href.slice(0, qIndex);
  const qs = href.slice(qIndex + 1);
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(qs)) {
    params[key] = value;
  }

  router.push({ pathname, params } as never);
}
