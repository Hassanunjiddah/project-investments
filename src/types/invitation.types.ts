export type InviteStatus =
  | 'INVITED'
  | 'ACCEPTED'
  | 'COMMITTED'
  | 'PROOF_SUBMITTED'
  | 'CONFIRMED'
  | 'DECLINED';

export type Invite = {
  id: string;
  projectId: string;
  investorId: string;
  email?: string;
  status: InviteStatus;
  amountKobo?: number;
  projectedProfitKobo?: number;
  projectName?: string;
  investorName?: string;
  proofName?: string;
  proofFileName?: string;
  proofStoragePath?: string;
};

export type InvitationDocSummary = {
  id: string;
  kind: string;
  title: string;
  fileName: string;
};

export type InvitationProjectTeaser = {
  id: string;
  name: string;
  sector: string;
  summary: string;
  risks: string;
  targetKobo: number;
  fullDetails?: string;
  timeline?: string;
  location?: string;
  stage?: string;
  approvalStatus?: string;
  raisedKobo?: number;
};

export type InvitationDetail = {
  invite: {
    id: string;
    projectId: string;
    investorId: string;
    status: InviteStatus;
    amountKobo?: number;
    projectedProfitKobo?: number;
    proofName?: string | null;
    proofFileName?: string | null;
    proofStoragePath?: string | null;
  };
  project: InvitationProjectTeaser;
  documents?: InvitationDocSummary[];
  payAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  mudarabahTerms: {
    profitSplitInvestorBps: number;
    exitNoticeDays: number;
    earlyExitPenaltyBps: number;
  };
};

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  INVITED: 'Invited',
  ACCEPTED: 'Accepted',
  COMMITTED: 'Committed',
  PROOF_SUBMITTED: 'Proof Submitted',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
};
