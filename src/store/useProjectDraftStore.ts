import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DocKind } from '@/src/types/document.types';
import type {
  ProjectBasicsFormValues,
  ProjectDetailsFormValues,
} from '@/src/schemas/project.schema';

export type DraftBanner = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Key into the in-memory banner byte cache (survives blob: URI expiry). */
  cacheKey?: string;
};

export type DraftDocument = {
  localId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: DocKind;
  title: string;
  note?: string;
  amountMinor?: number;
  /** Key into the in-memory brief byte cache (survives inbox file deletion). */
  cacheKey?: string;
};

export type ProjectDraft = {
  step: 1 | 2 | 3 | 4;
  basics: ProjectBasicsFormValues;
  details: ProjectDetailsFormValues;
  banner: DraftBanner | null;
  documents: DraftDocument[];
  updatedAt: string;
};

const emptyBasics: ProjectBasicsFormValues = {
  name: '',
  sector: '',
  location: '',
  targetAmount: 0,
  durationValue: 12,
  durationUnit: 'MONTHS',
  totalUnits: 50,
  minUnitsPerInvestor: 1,
  platformFeePct: 7.5,
};

const emptyDetails: ProjectDetailsFormValues = {
  summary: '',
  fullDetails: '',
  risks: '',
  timeline: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  estimatedRoiPct: 18,
  isPublic: false,
  managerSharePct: 30,
};

const initialDraft: ProjectDraft = {
  step: 1,
  basics: emptyBasics,
  details: emptyDetails,
  banner: null,
  documents: [],
  updatedAt: new Date().toISOString(),
};

type ProjectDraftState = {
  draft: ProjectDraft;
  setStep: (step: ProjectDraft['step']) => void;
  setBasics: (basics: ProjectBasicsFormValues) => void;
  setDetails: (details: ProjectDetailsFormValues) => void;
  setBanner: (banner: DraftBanner | null) => void;
  addDocument: (doc: DraftDocument) => void;
  updateDocument: (localId: string, patch: Partial<DraftDocument>) => void;
  removeDocument: (localId: string) => void;
  resetDraft: () => ProjectDraft;
  hasDraft: () => boolean;
};

export const useProjectDraftStore = create<ProjectDraftState>()(
  persist(
    (set, get) => ({
      draft: initialDraft,
      setStep: (step) =>
        set((state) => ({
          draft: { ...state.draft, step, updatedAt: new Date().toISOString() },
        })),
      setBasics: (basics) =>
        set((state) => ({
          draft: { ...state.draft, basics, updatedAt: new Date().toISOString() },
        })),
      setDetails: (details) =>
        set((state) => ({
          draft: { ...state.draft, details, updatedAt: new Date().toISOString() },
        })),
      setBanner: (banner) =>
        set((state) => ({
          draft: { ...state.draft, banner, updatedAt: new Date().toISOString() },
        })),
      addDocument: (doc) =>
        set((state) => ({
          draft: {
            ...state.draft,
            documents: [...state.draft.documents, doc],
            updatedAt: new Date().toISOString(),
          },
        })),
      updateDocument: (localId, patch) =>
        set((state) => ({
          draft: {
            ...state.draft,
            documents: state.draft.documents.map((d) =>
              d.localId === localId ? { ...d, ...patch } : d,
            ),
            updatedAt: new Date().toISOString(),
          },
        })),
      removeDocument: (localId) =>
        set((state) => ({
          draft: {
            ...state.draft,
            documents: state.draft.documents.filter((d) => d.localId !== localId),
            updatedAt: new Date().toISOString(),
          },
        })),
      resetDraft: () => {
        set({ draft: { ...initialDraft, updatedAt: new Date().toISOString() } });
        return initialDraft;
      },
      hasDraft: () => {
        const { draft } = get();
        const hasContent =
          draft.basics.name ||
          draft.basics.sector ||
          draft.details.summary ||
          draft.banner ||
          draft.documents.length > 0;
        if (!hasContent) return false;
        const age = Date.now() - new Date(draft.updatedAt).getTime();
        return age < 7 * 24 * 60 * 60 * 1000;
      },
    }),
    {
      name: 'ribhshare:project-draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ draft: state.draft }),
      // blob:/data: URIs do not survive a reload. Drop the banner so the user
      // re-picks it rather than hitting "Failed to fetch" on submit.
      onRehydrateStorage: () => (state) => {
        if (!state?.draft.banner) return;
        const uri = state.draft.banner.uri ?? '';
        if (uri.startsWith('blob:') || uri.startsWith('data:')) {
          state.draft.banner = null;
        }
      },
    },
  ),
);
