import type { PayAccount } from '@/src/types/project.types';
import type { DraftDocument, DraftBanner } from '@/src/store/useProjectDraftStore';
import { invokeCreateProject, invokeSubmitProject } from '@/src/services/edgeFunctions.services';
import { uploadProjectDocument, attachStorageDocument } from '@/src/services/documents.services';
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
    targetAmount: number;
    durationValue: number;
    durationUnit: 'DAYS' | 'WEEKS' | 'MONTHS';
    totalUnits?: number;
    minUnitsPerInvestor?: number;
    platformFeePct?: number;
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
    managerSharePct?: number;
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

// The new one-brief wizard only produces an OVERVIEW document (auto-uploaded
// via the extractor). RISK / DECISION are no longer collected separately.
const REQUIRED_DOC_KINDS = ['OVERVIEW'] as const;

// URIs produced by the wizard's Upload step use this scheme to signal that
// the file already lives in Supabase Storage and just needs to be moved
// out of `inbox/` into the project folder.
const STORAGE_URI_SCHEME = 'supabase-storage://';

function parseStorageUri(uri: string): { bucket: string; path: string } | null {
  if (!uri.startsWith(STORAGE_URI_SCHEME)) return null;
  const rest = uri.slice(STORAGE_URI_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export async function createProjectWithDocuments(
  draft: CreateProjectDraftInput,
  _userId: string,
  onProgress?: (message: string) => void,
): Promise<CreateProjectWithDocumentsResult> {
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
      targetMinor: nairaToKobo(draft.basics.targetAmount),
      durationValue: draft.basics.durationValue,
      durationUnit: draft.basics.durationUnit,
      summary: draft.details.summary,
      fullDetails: draft.details.fullDetails,
      risks: draft.details.risks,
      timeline: draft.details.timeline,
      payAccount,
      estimatedRoiBps: roiToBps(draft.details.estimatedRoiPct),
      isPublic: draft.details.isPublic ?? false,
      // Convert manager share % → investor bps. Default manager share = 30%
      // means investors receive 70% (7000 bps).
      profitSplitInvestorBps:
        draft.details.managerSharePct !== undefined
          ? 10000 - Math.round(draft.details.managerSharePct * 100)
          : 7000,
      exitNoticeDays: draft.details.exitNoticeDays,
      earlyExitPenaltyBps: draft.details.earlyExitPenaltyBps,
      totalUnits: draft.basics.totalUnits,
      minUnitsPerInvestor: draft.basics.minUnitsPerInvestor,
      platformFeeBps:
        draft.basics.platformFeePct !== undefined
          ? Math.round(draft.basics.platformFeePct * 100)
          : undefined,
    });
    projectId = result.projectId;
    code = result.code;
    approvalStatus = result.approvalStatus;
  } catch (error) {
    throw normalizeError(error);
  }

  try {
    if (draft.banner) {
      onProgress?.('Uploading banner…');
      await uploadProjectBanner({
        projectId,
        uri: draft.banner.uri,
        fileName: draft.banner.fileName,
        mimeType: draft.banner.mimeType,
      });
    }
  } catch (error) {
    await rollbackProject(projectId);
    throw normalizeError(error);
  }

  const failedDocuments: string[] = [];
  let uploadedCount = 0;
  let lastUploadError: string | undefined;

  for (let i = 0; i < draft.documents.length; i++) {
    const doc = draft.documents[i];
    onProgress?.(`Uploading documents (${i + 1}/${draft.documents.length})…`);
    try {
      const storageRef = parseStorageUri(doc.uri);
      if (storageRef) {
        // File already lives in Supabase Storage (uploaded by the wizard's
        // Upload step into `inbox/`). Move it into the project folder
        // rather than fetching + re-uploading.
        await attachStorageDocument({
          projectId,
          userId: _userId,
          sourceBucket: storageRef.bucket,
          sourcePath: storageRef.path,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          kind: doc.kind,
          title: doc.title,
          note: doc.note,
        });
      } else {
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
      }
      uploadedCount++;
    } catch (error) {
      failedDocuments.push(doc.fileName);
      lastUploadError = error instanceof Error ? error.message : undefined;
    }
  }

  // Any document failure aborts the whole create — never leave a half-built
  // project sitting in the list for the CEO to review.
  if (failedDocuments.length > 0) {
    await rollbackProject(projectId);
    throw new AppError(
      lastUploadError ??
        `Document upload failed (${failedDocuments.join(', ')}). Nothing was created — please try again.`,
    );
  }

  if (uploadedCount < draft.documents.length || draft.documents.length === 0) {
    await rollbackProject(projectId);
    throw new AppError('A project brief must be attached before submit. Nothing was created.');
  }

  if (approvalStatus === 'PENDING') {
    onProgress?.('Submitting for CEO review…');
    try {
      const submitted = await invokeSubmitProject(projectId);
      approvalStatus = submitted.approvalStatus;
      code = submitted.code;
    } catch (error) {
      await rollbackProject(projectId);
      throw normalizeError(error);
    }
  }

  return { projectId, code, approvalStatus, uploadedCount, failedDocuments };
}

/** Delete a just-created project. Throws if rollback itself fails so we never
 *  pretend the create succeeded after a partial failure. */
async function rollbackProject(projectId: string): Promise<void> {
  try {
    await deleteProject(projectId);
  } catch (rollbackError) {
    console.error('create-project rollback failed', projectId, rollbackError);
    throw new AppError(
      'Project creation failed and could not be fully cleaned up. Please delete the draft from Projects and try again.',
    );
  }
}
