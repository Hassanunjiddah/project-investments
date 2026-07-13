const PASSWORD_WORDS = ['river', 'trade', 'share', 'green', 'market', 'ledger', 'profit', 'sun'];

export function generateSimplePassword(): string {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const digits = 1000 + Math.floor(Math.random() * 9000);
  return `${word}${digits}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
