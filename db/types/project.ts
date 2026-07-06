export type ProjectStage = 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MilestoneStatus = 'completed' | 'in_progress' | 'pending';

export type Milestone = {
  id: string;
  label: string;
  status: MilestoneStatus;
};

export type MockProject = {
  id: string;
  name: string;
  sector: string;
  location: string;
  coverImageUrl: string;
  stage: ProjectStage;
  approvalStatus: ApprovalStatus;
  targetKobo: number;
  raisedKobo: number;
  estimatedRoiPct: number;
  durationMonths: number;
  exitNoticeDays: number;
  earlyExitPenaltyBps: number;
  profitSplitInvestorBps: number;
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  createdBy: string;
  createdAt: string;
  investorCount?: number;
  milestones?: Milestone[];
  fundingDeadline?: string;
};

export type MockProjectWithCreator = MockProject & {
  creatorName: string;
  creatorVerified?: boolean;
};

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
