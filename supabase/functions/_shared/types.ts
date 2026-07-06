export type PayAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

export type InviteStatus =
  | 'INVITED'
  | 'ACCEPTED'
  | 'COMMITTED'
  | 'PROOF_SUBMITTED'
  | 'CONFIRMED'
  | 'DECLINED';

export function parsePayAccount(value: unknown): PayAccount {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('payAccount is required');
  }
  const obj = value as Record<string, unknown>;
  const bankName = String(obj.bankName ?? '').trim();
  const accountName = String(obj.accountName ?? '').trim();
  const accountNumber = String(obj.accountNumber ?? '').trim();
  if (bankName.length < 2 || accountName.length < 2 || accountNumber.length < 10) {
    throw new Error('Invalid payAccount: bankName, accountName, and accountNumber are required');
  }
  return { bankName, accountName, accountNumber };
}

const ACCEPTED_STATUSES: InviteStatus[] = ['ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED'];
const COMMITTED_STATUSES: InviteStatus[] = ['COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED'];

export function canSeeFullDetails(status: InviteStatus): boolean {
  return ACCEPTED_STATUSES.includes(status);
}

export function canSeePayAccount(status: InviteStatus): boolean {
  return COMMITTED_STATUSES.includes(status);
}
