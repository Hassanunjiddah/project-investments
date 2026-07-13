import type { PayAccount } from '@/src/types/project.types';
import type { DraftDocument, DraftBanner } from '@/src/store/useProjectDraftStore';
import { invokeCreateProject, invokeSubmitProject } from '@/src/services/edgeFunctions.services';
import { uploadProjectDocument } from '@/src/services/documents.services';
import { uploadProjectBanner } from '@/src/services/banner.services';
import { deleteProject } from '@/src/services/projects.services';
import { nairaToKobo } from '@/src/utils/currency';
import { percentToBps as roiToBps } from '@/src/types/project.types';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';

export type CreateProjectDraftInput = {
  basics: {
    name: string;
    sector: string;
    location: string;
    targetNaira: number;
    durationValue: number;
    durationUnit: 'DAYS' | 'WEEKS' | 'MONTHS';
  };
  details: {
    summary: string;
    fullDetails: string;
    risks: string;
    timeline: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    estimatedRoiPct: number;
    isPublic?: boolean;
    profitSplitInvestorBps?: number;
    exitNoticeDays?: number;
    earlyExitPenaltyBps?: number;
  };
  banner: DraftBanner | null;
  documents: DraftDocument[];
};

export type CreateProjectWithDocumentsResult = {
  projectId: string;
  code: string;
  approvalStatus: string;
  uploadedCount: number;
  failedDocuments: string[];
};

const REQUIRED_DOC_KINDS = ['OVERVIEW', 'FUND_USE', 'RISK', 'DECISION'] as const;

export async function createProjectWithDocuments(
  draft: CreateProjectDraftInput,
  _userId: string,
  onProgress?: (message: string) => void,
): Promise<CreateProjectWithDocumentsResult> {
  if (!draft.banner) {
    throw new AppError('Banner image is required');
  }

  const docKinds = new Set(draft.documents.map((d) => d.kind));
  for (const kind of REQUIRED_DOC_KINDS) {
    if (!docKinds.has(kind)) {
      throw new AppError(`Missing required document: ${kind}`);
    }
  }

  const payAccount: PayAccount = {
    bankName: draft.details.bankName,
    accountName: draft.details.accountName,
    accountNumber: draft.details.accountNumber,
  };

  onProgress?.('Creating project…');
  let projectId: string;
  let code: string;
  let approvalStatus: string;
  try {
    const result = await invokeCreateProject({
      name: draft.basics.name,
      sector: draft.basics.sector,
      location: draft.basics.location,
      targetMinor: nairaToKobo(draft.basics.targetNaira),
      durationValue: draft.basics.durationValue,
      durationUnit: draft.basics.durationUnit,
      summary: draft.details.summary,
      fullDetails: draft.details.fullDetails,
      risks: draft.details.risks,
      timeline: draft.details.timeline,
      payAccount,
      estimatedRoiBps: roiToBps(draft.details.estimatedRoiPct),
      isPublic: draft.details.isPublic ?? false,
      profitSplitInvestorBps: draft.details.profitSplitInvestorBps,
      exitNoticeDays: draft.details.exitNoticeDays,
      earlyExitPenaltyBps: draft.details.earlyExitPenaltyBps,
    });
    projectId = result.projectId;
    code = result.code;
    approvalStatus = result.approvalStatus;
  } catch (error) {
    throw normalizeError(error);
  }

  try {
    onProgress?.('Uploading banner…');
    await uploadProjectBanner({
      projectId,
      uri: draft.banner.uri,
      fileName: draft.banner.fileName,
      mimeType: draft.banner.mimeType,
    });
  } catch (error) {
    try {
      await deleteProject(projectId);
    } catch {
      // best effort rollback
    }
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
        userId: _userId,
        uri: doc.uri,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        kind: doc.kind,
        title: doc.title,
        note: doc.note,
        amountMinor: doc.amountMinor,
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

  if (approvalStatus === 'PENDING') {
    onProgress?.('Submitting for CEO review…');
    try {
      const submitted = await invokeSubmitProject(projectId);
      approvalStatus = submitted.approvalStatus;
      code = submitted.code;
    } catch (error) {
      try {
        await deleteProject(projectId);
      } catch {
        // best effort rollback
      }
      throw normalizeError(error);
    }
  }

  return { projectId, code, approvalStatus, uploadedCount, failedDocuments };
}
