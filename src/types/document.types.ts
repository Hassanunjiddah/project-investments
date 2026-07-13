export type DocKind = 'OVERVIEW' | 'FUND_USE' | 'RISK' | 'DECISION';

export type ProjectDocument = {
  id: string;
  projectId: string;
  kind: DocKind;
  title: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes?: number;
  amountMinor?: number;
  /** @deprecated use amountMinor */
  amountKobo?: number;
  note?: string;
  uploadedBy: string;
  createdAt: string;
};

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  OVERVIEW: 'Project overview',
  FUND_USE: 'Fund use',
  RISK: 'Risk / mitigation',
  DECISION: 'Key decision',
};
