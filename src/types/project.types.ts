export type ProjectStage = 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type ProfitDeclarationFrequency =
  | 'DAILY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'YEARLY';

export type PayAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  sector: string;
  location: string;
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  stage: ProjectStage;
  approvalStatus: ApprovalStatus;
  currencyCode: string;
  targetMinor: number;
  raisedMinor: number;
  /** Cumulative paid drawdowns. Current capital = raised - raiseFee - drawn. */
  drawnMinor: number;
  /** Raise fee rate in bps of capital raised (reserved at target hit). */
  raiseFeeBps?: number;
  /** Accrued raise fee in kobo (0 until target reached). */
  raiseFeeMinor: number;
  estimatedRoiBps: number;
  durationValue: number;
  durationUnit: DurationUnit;
  /** Expected cadence for declaring realised profit. */
  profitDeclarationFrequency: ProfitDeclarationFrequency;
  isPublic: boolean;
  submittedAt?: string;
  profitSplitInvestorBps: number;
  exitNoticeDays: number;
  earlyExitPenaltyBps: number;
  createdBy: { id: string; full_name: string };
  /** Originator party — distinct from createdBy (Prism LM). */
  projectOwnerId?: string;
  projectOwner?: { id: string; full_name: string; email?: string | null };
  approvedBy?: { id: string; full_name: string };
  approvedAt?: string;
  rejectedBy?: { id: string; full_name: string };
  rejectedAt?: string;
  rejectionNote?: string;
  payAccount?: PayAccount;
  bannerStoragePath?: string;
  bannerMimeType?: string;
  bannerUrl?: string;
  createdAt?: string;
  realisedProfitMinor: number;
  progressStartedAt?: string;
  /** Prism unit model — nullable until backfilled */
  totalUnits?: number;
  unitPriceMinor?: number;
  minUnitsPerInvestor?: number;
  platformFeeBps?: number;
  pledgeExpiryHours?: number;
  /** @deprecated use targetMinor */
  targetKobo: number;
  /** @deprecated use raisedMinor */
  raisedKobo: number;
};

export type CreateProjectInput = {
  name: string;
  sector: string;
  location: string;
  targetMinor: number;
  durationValue: number;
  durationUnit: DurationUnit;
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  estimatedRoiBps?: number;
  isPublic?: boolean;
  profitSplitInvestorBps?: number;
  profitDeclarationFrequency?: ProfitDeclarationFrequency;
  exitNoticeDays?: number;
  earlyExitPenaltyBps?: number;
  payAccount?: PayAccount;
  /** Prism unit model */
  totalUnits?: number;
  minUnitsPerInvestor?: number;
  platformFeeBps?: number;
  raiseFeeBps?: number;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  INITIATION: 'Initiation',
  ACCEPTANCE: 'Acceptance',
  PROGRESS: 'Progress',
  END: 'End',
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  DAYS: 'days',
  WEEKS: 'weeks',
  MONTHS: 'months',
};

export const PROFIT_DECLARATION_FREQUENCY_LABELS: Record<
  ProfitDeclarationFrequency,
  string
> = {
  DAILY: 'Daily',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-annually',
  YEARLY: 'Yearly',
};

export const PROFIT_DECLARATION_FREQUENCIES: ProfitDeclarationFrequency[] = [
  'DAILY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'YEARLY',
];

export function formatDuration(value: number, unit: DurationUnit): string {
  return `${value} ${DURATION_UNIT_LABELS[unit]}`;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}
