import type { PayAccount } from '@/src/types/project.types';
import type { DraftDocument, DraftBanner } from '@/src/store/useProjectDraftStore';
import { invokeCreateProject, invokeSubmitProject } from '@/src/services/edgeFunctions.services';
import {
  uploadProjectDocument,
  attachStorageDocument,
  removeInboxBrief,
} from '@/src/services/documents.services';
import { uploadProjectBanner } from '@/src/services/banner.services';
import { getBannerCache, clearBannerCache } from '@/src/services/bannerDraftCache';
import { getBriefCache, clearBriefCache } from '@/src/services/briefDraftCache';
import { deleteProject } from '@/src/services/projects.services';
import { supabase } from '@/src/services/supabase';
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

const REQUIRED_DOC_KINDS = ['OVERVIEW'] as const;
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
  userId: string,
  onProgress?: (message: string) => void,
): Promise<CreateProjectWithDocumentsResult> {
  const docKinds = new Set(draft.documents.map((d) => d.kind));
  for (const kind of REQUIRED_DOC_KINDS) {
    if (!docKinds.has(kind)) {
      throw new AppError(
        'Project brief is required — go back to Upload and select your brief file.',
      );
    }
  }

  // Ensure every storage-backed doc is either still in storage OR cached in
  // memory. Prefer the cache so a deleted inbox object never blocks submit.
  onProgress?.('Checking project brief…');
  await assertDocumentsReady(draft.documents);

  const details = {
    ...draft.details,
    // Extraction sometimes fills summary but not fullDetails; mirror so the
    // edge function's required-field check doesn't reject a valid draft.
    fullDetails:
      draft.details.fullDetails?.trim().length >= 10
        ? draft.details.fullDetails
        : draft.details.summary,
  };

  const payAccount: PayAccount = {
    bankName: details.bankName,
    accountName: details.accountName,
    accountNumber: details.accountNumber,
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
      summary: details.summary,
      fullDetails: details.fullDetails,
      risks: details.risks,
      timeline: details.timeline,
      payAccount,
      estimatedRoiBps: roiToBps(details.estimatedRoiPct),
      isPublic: details.isPublic ?? false,
      profitSplitInvestorBps:
        details.managerSharePct !== undefined
          ? 10000 - Math.round(details.managerSharePct * 100)
          : 7000,
      exitNoticeDays: details.exitNoticeDays,
      earlyExitPenaltyBps: details.earlyExitPenaltyBps,
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

  if (draft.banner) {
    onProgress?.('Uploading banner…');
    const cached = getBannerCache(draft.banner.cacheKey);
    const staleBlob = !cached && /^blob:/i.test(draft.banner.uri);
    if (!staleBlob) {
      try {
        await uploadProjectBanner({
          projectId,
          uri: draft.banner.uri,
          fileName: draft.banner.fileName,
          mimeType: draft.banner.mimeType,
          bytes: cached?.bytes,
        });
        if (draft.banner.cacheKey) clearBannerCache(draft.banner.cacheKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/no longer available|failed to fetch|object not found/i.test(message)) {
          console.warn('Skipping stale banner during create', error);
        } else {
          await rollbackProject(projectId);
          throw normalizeError(error);
        }
      }
    }
  }

  const failedDocuments: string[] = [];
  let uploadedCount = 0;
  let lastUploadError: string | undefined;
  const inboxPathsToClean: string[] = [];

  for (let i = 0; i < draft.documents.length; i++) {
    const doc = draft.documents[i];
    onProgress?.(`Uploading documents (${i + 1}/${draft.documents.length})…`);
    try {
      await attachDraftDocument(projectId, userId, doc, inboxPathsToClean);
      uploadedCount++;
    } catch (error) {
      failedDocuments.push(doc.fileName);
      lastUploadError = error instanceof Error ? error.message : undefined;
    }
  }

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

  await Promise.all(inboxPathsToClean.map((p) => removeInboxBrief(p)));

  return { projectId, code, approvalStatus, uploadedCount, failedDocuments };
}

async function attachDraftDocument(
  projectId: string,
  userId: string,
  doc: DraftDocument,
  inboxPathsToClean: string[],
): Promise<void> {
  const cached = getBriefCache(doc.cacheKey);
  if (cached) {
    // Preferred path: upload cached bytes straight into the project folder.
    // Independent of whether the inbox object still exists.
    await uploadProjectDocument({
      projectId,
      userId,
      uri: doc.uri,
      fileName: cached.fileName || doc.fileName,
      mimeType: cached.mimeType || doc.mimeType,
      sizeBytes: cached.sizeBytes || doc.sizeBytes,
      kind: doc.kind,
      title: doc.title,
      note: doc.note,
      amountMinor: doc.amountMinor,
      bytes: cached.bytes,
    });
    if (doc.cacheKey) clearBriefCache(doc.cacheKey);
    const storageRef = parseStorageUri(doc.uri);
    if (storageRef?.path.startsWith('inbox/')) {
      inboxPathsToClean.push(storageRef.path);
    }
    return;
  }

  const storageRef = parseStorageUri(doc.uri);
  if (storageRef) {
    await attachStorageDocument({
      projectId,
      userId,
      sourceBucket: storageRef.bucket,
      sourcePath: storageRef.path,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      kind: doc.kind,
      title: doc.title,
      note: doc.note,
    });
    if (storageRef.path.startsWith('inbox/')) {
      inboxPathsToClean.push(storageRef.path);
    }
    return;
  }

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
    amountMinor: doc.amountMinor,
  });
}

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

async function assertDocumentsReady(documents: DraftDocument[]): Promise<void> {
  for (const doc of documents) {
    if (getBriefCache(doc.cacheKey)) continue;

    const ref = parseStorageUri(doc.uri);
    if (!ref) {
      if (/^blob:/i.test(doc.uri)) {
        throw new AppError(
          'Project brief is no longer available — go back to Upload and re-select the brief.',
        );
      }
      continue;
    }

    const { error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 60);
    if (error) {
      throw new AppError(
        'Project brief is missing from storage — go back to Upload and re-select the brief, then submit again.',
      );
    }
  }
}
