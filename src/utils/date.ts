export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthYear(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** moment().calendar() analogue — "Today at 3:04 PM" / date. */
export function calendarTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startThat - startToday) / 86400000);
  const time = d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  if (dayDiff === 0) return `Today at ${time}`;
  if (dayDiff === -1) return `Yesterday at ${time}`;
  if (dayDiff === 1) return `Tomorrow at ${time}`;
  return formatDateTime(d);
}

export function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(d);
}
