export type ProjectStage = 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PayAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

export type Project = {
  id: string;
  name: string;
  sector: string;
  location: string;
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  stage: ProjectStage;
  approvalStatus: ApprovalStatus;
  targetKobo: number;
  raisedKobo: number;
  profitSplitInvestorBps: number;
  exitNoticeDays: number;
  earlyExitPenaltyBps: number;
  createdBy: string;
  payAccount?: PayAccount;
  createdAt?: string;
};

export type CreateProjectInput = {
  name: string;
  sector: string;
  location: string;
  targetKobo: number;
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  profitSplitInvestorBps?: number;
  exitNoticeDays?: number;
  earlyExitPenaltyBps?: number;
  payAccount?: PayAccount;
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
