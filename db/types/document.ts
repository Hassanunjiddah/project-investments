export type DocKind = 'OVERVIEW' | 'FUND_USE' | 'RISK' | 'DECISION';

export type ProjectDocument = {
  id: string;
  projectId: string;
  kind: DocKind;
  title: string;
  fileName: string;
  uploadedAt: string;
};

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  OVERVIEW: 'Project Overview',
  FUND_USE: 'Fund Use Statement',
  RISK: 'Risk Assessment',
  DECISION: 'Key Decision',
};
