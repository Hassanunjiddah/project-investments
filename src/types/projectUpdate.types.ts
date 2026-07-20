export type ProjectUpdateKind =
  | 'RISK'
  | 'FUND_USE'
  | 'ENGAGEMENT'
  | 'MILESTONE'
  | 'ANNOUNCEMENT';

export type ProjectUpdate = {
  id: string;
  projectId: string;
  kind: ProjectUpdateKind;
  title: string;
  body: string;
  amountMinor?: number;
  postedBy: string;
  postedByName?: string;
  createdAt: string;
};

export const PROJECT_UPDATE_KIND_LABELS: Record<ProjectUpdateKind, string> = {
  RISK: 'Risk',
  FUND_USE: 'Fund Use',
  ENGAGEMENT: 'Engagement',
  MILESTONE: 'Milestone',
  ANNOUNCEMENT: 'Announcement',
};

export const PROJECT_UPDATE_KIND_ORDER: ProjectUpdateKind[] = [
  'ANNOUNCEMENT',
  'MILESTONE',
  'FUND_USE',
  'RISK',
  'ENGAGEMENT',
];
