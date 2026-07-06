export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}
function formatCompactNumber(number: number): string {
  if (number < 0) {
    return '-' + formatCompactNumber(-1 * number);
  }
  if (number < 1000) {
    return number.toString();
  } else if (number >= 1000 && number < 1_000_000) {
    return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else if (number >= 1_000_000 && number < 1_000_000_000) {
    return (number / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (number >= 1_000_000_000 && number < 1_000_000_000_000) {
    return (number / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (number >= 1_000_000_000_000 && number < 1_000_000_000_000_000) {
    return (number / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'T';
  }
  return number.toString();
}

const formatCurrency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

export function formatNaira(kobo: number, short = true): string {
  const naira = koboToNaira(kobo);
  return short ? `₦${formatCompactNumber(naira)}` : formatCurrency.format(naira);
}
