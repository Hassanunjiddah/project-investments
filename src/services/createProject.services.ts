import type { PayAccount } from '@/src/types/project.types';
import type { DraftDocument } from '@/src/store/useProjectDraftStore';
import { invokeCreateProject } from '@/src/services/edgeFunctions.services';
import { uploadProjectDocument } from '@/src/services/documents.services';
import { deleteProject } from '@/src/services/projects.services';
import { nairaToKobo } from '@/src/utils/currency';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';

export type CreateProjectDraftInput = {
  basics: {
    name: string;
    sector: string;
    location: string;
    targetNaira: number;
  };
  details: {
    summary: string;
    fullDetails: string;
    risks: string;
    timeline: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    profitSplitInvestorBps?: number;
    exitNoticeDays?: number;
    earlyExitPenaltyBps?: number;
  };
  documents: DraftDocument[];
};

export type CreateProjectWithDocumentsResult = {
  projectId: string;
  uploadedCount: number;
  failedDocuments: string[];
};

export async function createProjectWithDocuments(
  draft: CreateProjectDraftInput,
  userId: string,
  onProgress?: (message: string) => void,
): Promise<CreateProjectWithDocumentsResult> {
  const payAccount: PayAccount = {
    bankName: draft.details.bankName,
    accountName: draft.details.accountName,
    accountNumber: draft.details.accountNumber,
  };

  onProgress?.('Creating project…');
  let projectId: string;
  try {
    const result = await invokeCreateProject({
      name: draft.basics.name,
      sector: draft.basics.sector,
      location: draft.basics.location,
      targetKobo: nairaToKobo(draft.basics.targetNaira),
      summary: draft.details.summary,
      fullDetails: draft.details.fullDetails,
      risks: draft.details.risks,
      timeline: draft.details.timeline,
      payAccount,
      profitSplitInvestorBps: draft.details.profitSplitInvestorBps,
      exitNoticeDays: draft.details.exitNoticeDays,
      earlyExitPenaltyBps: draft.details.earlyExitPenaltyBps,
    });
    projectId = result.projectId;
  } catch (error) {
    throw normalizeError(error);
  }

  const failedDocuments: string[] = [];
  let uploadedCount = 0;
  let lastUploadError: string | undefined;

  for (let i = 0; i < draft.documents.length; i++) {
    const doc = draft.documents[i];
    onProgress?.(`Uploading documents (${i + 1}/${draft.documents.length})…`);
    try {
      await uploadProjectDocument({
        projectId,
        userId,
        uri: doc.uri,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        kind: doc.kind,
        title: doc.title,
        note: doc.note,
        amountKobo: doc.amountKobo,
      });
      uploadedCount++;
    } catch (error) {
      failedDocuments.push(doc.fileName);
      lastUploadError = error instanceof Error ? error.message : undefined;
    }
  }

  if (failedDocuments.length > 0 && uploadedCount === 0 && draft.documents.length > 0) {
    try {
      await deleteProject(projectId);
    } catch {
      // best effort rollback
    }
    throw new AppError(
      lastUploadError ??
        `Project created but all document uploads failed (${failedDocuments.join(', ')}). Please try again.`,
    );
  }

  return { projectId, uploadedCount, failedDocuments };
}
