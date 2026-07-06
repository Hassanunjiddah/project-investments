import type { ProjectDocument } from '../types/document';

export const MOCK_DOCUMENTS: ProjectDocument[] = [
  {
    id: 'doc-1',
    projectId: 'PRJ-104',
    kind: 'OVERVIEW',
    title: 'Project Overview Pack',
    fileName: 'PRJ-104-overview.pdf',
    uploadedAt: '2025-01-20',
  },
  {
    id: 'doc-2',
    projectId: 'PRJ-104',
    kind: 'FUND_USE',
    title: 'Fund Use Statement',
    fileName: 'PRJ-104-fund-use.pdf',
    uploadedAt: '2025-02-01',
  },
  {
    id: 'doc-3',
    projectId: 'PRJ-118',
    kind: 'OVERVIEW',
    title: 'Project Overview Pack',
    fileName: 'PRJ-118-overview.pdf',
    uploadedAt: '2025-05-02',
  },
  {
    id: 'doc-4',
    projectId: 'PRJ-118',
    kind: 'RISK',
    title: 'Risk Assessment',
    fileName: 'PRJ-118-risk.pdf',
    uploadedAt: '2025-05-02',
  },
  {
    id: 'doc-5',
    projectId: 'PRJ-121',
    kind: 'OVERVIEW',
    title: 'Project Overview Pack',
    fileName: 'PRJ-121-overview.pdf',
    uploadedAt: '2025-02-25',
  },
  {
    id: 'doc-6',
    projectId: 'PRJ-121',
    kind: 'RISK',
    title: 'Risk Assessment',
    fileName: 'PRJ-121-risk.pdf',
    uploadedAt: '2025-03-01',
  },
];
