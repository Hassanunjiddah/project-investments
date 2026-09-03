import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { useCreateProjectWithDocuments } from '@/src/hooks/projects/useCreateProjectWithDocuments';
import { useUiStore } from '@/src/store/useUiStore';
import { CreateProjectStepUpload } from '@/src/screens/projects/steps/CreateProjectStepUpload';
import { CreateProjectStepBasics } from '@/src/screens/projects/steps/CreateProjectStepBasics';
import { CreateProjectStepDetails } from '@/src/screens/projects/steps/CreateProjectStepDetails';
import { CreateProjectStepReview } from '@/src/screens/projects/steps/CreateProjectStepReview';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { colors } from '@/src/constants/colors';
import { FORM_MAX_WIDTH } from '@/src/constants/layout';
import { Button } from '@/src/components/ui/Button';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { Resolver, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ProjectBasicsFormValues,
  projectBasicsSchema,
  ProjectDetailsFormValues,
  projectDetailsSchema,
} from '@/src/schemas/project.schema';
import { DocKind } from '@/src/types/document.types';
import { useAuthStore } from '@/src/store/useAuthStore';
import { canCreateProject } from '@/src/helpers/guards';
import type { UploadedBrief } from '@/src/services/briefExtraction.services';
import { clearBriefCache } from '@/src/services/briefDraftCache';
import { clearBannerCache } from '@/src/services/bannerDraftCache';
import { confirmDialog } from '@/src/utils/dialogs';

const STEPS = ['Upload', 'Basics', 'Details', 'Review'];
const STEP_HEADINGS = [
  {
    title: 'Upload brief',
    subtitle:
      "Drop in your project brief and we'll auto-fill the next steps for you. You can edit anything afterwards.",
  },
  {
    title: 'Basics',
    subtitle: 'Confirm the core details we extracted from your brief.',
  },
  {
    title: 'Details',
    subtitle: 'Review the financial terms, risks and timeline.',
  },
  { title: 'Review', subtitle: 'Review your project before submitting.' },
];

// Only the OVERVIEW slot is required; it's populated automatically by the
// Upload step. RISK / DECISION docs are no longer separate — the brief
// contains everything.
export const REQUIRED_SLOTS: { kind: DocKind; title: string }[] = [
  { kind: 'OVERVIEW', title: 'Project Brief' },
];

const STORAGE_URI_SCHEME = 'supabase-storage://';

function parseStorageUri(uri: string): { bucket: string; path: string } | null {
  if (!uri.startsWith(STORAGE_URI_SCHEME)) return null;
  const rest = uri.slice(STORAGE_URI_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

function briefFromDraftDoc(doc: {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): UploadedBrief | null {
  const ref = parseStorageUri(doc.uri);
  if (!ref) return null;
  return {
    bucket: ref.bucket,
    path: ref.path,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
  };
}

export default function CreateProjectWizard() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const scrollViewRef = useRef<ScrollView>(null);
  const submittingRef = useRef(false);
  const { hideTabBar, showTabBar } = useUiStore();
  const step = useProjectDraftStore((s) => s.draft.step);
  const setStep = useProjectDraftStore((s) => s.setStep);
  const draft = useProjectDraftStore((s) => s.draft);
  const hasDraft = useProjectDraftStore((s) => s.hasDraft);
  const resetDraft = useProjectDraftStore((s) => s.resetDraft);
  const setBasicsInStore = useProjectDraftStore((s) => s.setBasics);
  const setDetailsInStore = useProjectDraftStore((s) => s.setDetails);
  const createProject = useCreateProjectWithDocuments();
  const pushToast = useUiStore((s) => s.pushToast);
  const [progressMessage, setProgressMessage] = useState('');
  const [resumeChecked, setResumeChecked] = useState(false);
  const [hydrated, setHydrated] = useState(() => useProjectDraftStore.persist.hasHydrated());
  const [uploadedBrief, setUploadedBrief] = useState<UploadedBrief | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [extractionNotes, setExtractionNotes] = useState<string>('');
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    if (role && !canCreateProject(role)) {
      pushToast({ type: 'info', message: 'Only Prism Line Managers can create projects.' });
      router.replace('/(tabs)/projects' as never);
    }
  }, [role, router, pushToast]);

  useEffect(() => {
    const unsub = useProjectDraftStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProjectDraftStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  //Step 1 schema
  const basicsMethods = useForm<ProjectBasicsFormValues>({
    resolver: zodResolver(projectBasicsSchema) as Resolver<ProjectBasicsFormValues>,
    defaultValues: draft.basics,
    mode: 'onTouched',
  });

  //Step 2 schema
  const detailsMethods = useForm<ProjectDetailsFormValues>({
    resolver: zodResolver(projectDetailsSchema) as Resolver<ProjectDetailsFormValues>,
    defaultValues: draft.details,
    mode: 'onTouched',
  });

  const clearLocalWizardState = useCallback(() => {
    setUploadedBrief(null);
    setAutoFilledFields([]);
    setExtractionNotes('');
  }, []);

  const startFresh = useCallback(() => {
    const current = useProjectDraftStore.getState().draft;
    for (const doc of current.documents) {
      if (doc.cacheKey) clearBriefCache(doc.cacheKey);
    }
    if (current.banner?.cacheKey) clearBannerCache(current.banner.cacheKey);
    const fresh = resetDraft();
    clearLocalWizardState();
    basicsMethods.reset(fresh.basics);
    detailsMethods.reset(fresh.details);
  }, [resetDraft, clearLocalWizardState, basicsMethods, detailsMethods]);

  const loadDraft = useCallback(() => {
    const current = useProjectDraftStore.getState().draft;
    basicsMethods.reset(current.basics);
    detailsMethods.reset(current.details);
    const overview = current.documents.find((d) => d.kind === 'OVERVIEW');
    if (overview) {
      setUploadedBrief(briefFromDraftDoc(overview));
    }
  }, [basicsMethods, detailsMethods]);

  const validateDocuments = useCallback((): boolean => {
    const documents = useProjectDraftStore.getState().draft.documents;
    for (const slot of REQUIRED_SLOTS) {
      const doc = documents.find((d) => d.kind === slot.kind);
      if (!doc) {
        pushToast({ type: 'error', message: `${slot.title} is required.` });
        return false;
      }
    }
    return true;
  }, [pushToast]);

  const flushFormsToStore = useCallback(() => {
    setBasicsInStore(basicsMethods.getValues());
    setDetailsInStore(detailsMethods.getValues());
  }, [basicsMethods, detailsMethods, setBasicsInStore, setDetailsInStore]);

  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const isLastStep = step === 4;
  const buttonTitle = isLastStep
    ? role === 'CEO' || role === 'ADMIN'
      ? 'Submit'
      : 'Submit for Approval'
    : 'Continue';

  const roleHint =
    role === 'CEO' || role === 'ADMIN'
      ? 'As CEO/Admin, this project will be auto-approved.'
      : 'As Line Manager, this project will be submitted for CEO approval after upload.';

  const heading = isLastStep ? { title: 'Review', subtitle: roleHint } : STEP_HEADINGS[step - 1];

  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  useEffect(() => {
    if (!hydrated || resumeChecked) return;
    setResumeChecked(true);

    if (hasDraft()) {
      void (async () => {
        const resume = await confirmDialog({
          title: 'Resume draft?',
          message:
            'You have an unfinished project draft. Continue editing, or discard it and start fresh.',
          confirmLabel: 'Continue',
          cancelLabel: 'Start fresh',
          destructive: false,
        });
        if (resume) loadDraft();
        else startFresh();
      })();
    } else {
      // Still sync form defaults once hydration settles on an empty draft.
      loadDraft();
    }
  }, [hydrated, hasDraft, resumeChecked, startFresh, loadDraft]);

  const goBack = useCallback(() => {
    flushFormsToStore();
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
    else router.back();
  }, [step, setStep, router, flushFormsToStore]);

  const goNext = useCallback(async () => {
    if (step === 1) {
      // Upload step — user must have uploaded a brief (registered as OVERVIEW).
      const hasBrief = draft.documents.some((d) => d.kind === 'OVERVIEW');
      if (!hasBrief) {
        pushToast({
          type: 'error',
          message: 'Please upload your project brief before continuing.',
        });
        return;
      }
      // Re-hydrate the react-hook-form values from the (auto-filled) draft.
      basicsMethods.reset(draft.basics);
      detailsMethods.reset(draft.details);
    }
    if (step === 2) {
      const ok = await basicsMethods.trigger();
      if (!ok) {
        // Mark all currently-invalid fields as touched so their error
        // messages surface (FormInput only shows errors after touch).
        const values = basicsMethods.getValues();
        (Object.keys(values) as (keyof typeof values)[]).forEach((k) => {
          basicsMethods.setValue(k, values[k], { shouldTouch: true });
        });
        pushToast({ type: 'error', message: 'Please complete all required fields.' });
        return;
      }
      // Persist immediately so the review step sees the latest values.
      setBasicsInStore(basicsMethods.getValues());
    }
    if (step === 3) {
      const ok = await detailsMethods.trigger();
      if (!ok) {
        const values = detailsMethods.getValues();
        (Object.keys(values) as (keyof typeof values)[]).forEach((k) => {
          detailsMethods.setValue(k, values[k], { shouldTouch: true });
        });
        pushToast({ type: 'error', message: 'Please complete all required fields.' });
        return;
      }
      setDetailsInStore(detailsMethods.getValues());
      // Enforce that the brief is still attached.
      if (!validateDocuments()) return;
    }
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
  }, [
    step,
    setStep,
    basicsMethods,
    detailsMethods,
    validateDocuments,
    pushToast,
    setBasicsInStore,
    setDetailsInStore,
    draft,
  ]);

  const saveAndExit = useCallback(() => {
    flushFormsToStore();
    pushToast({ type: 'info', message: 'Draft saved.' });
    router.back();
  }, [flushFormsToStore, pushToast, router]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || createProject.isPending) return;
    submittingRef.current = true;

    flushFormsToStore();
    const latest = useProjectDraftStore.getState().draft;

    const basicsParsed = projectBasicsSchema.safeParse(latest.basics);
    if (!basicsParsed.success) {
      submittingRef.current = false;
      pushToast({
        type: 'error',
        message: basicsParsed.error.issues[0]?.message ?? 'Please fix Basics before submitting.',
      });
      setStep(2);
      return;
    }
    const detailsParsed = projectDetailsSchema.safeParse(latest.details);
    if (!detailsParsed.success) {
      submittingRef.current = false;
      pushToast({
        type: 'error',
        message: detailsParsed.error.issues[0]?.message ?? 'Please fix Details before submitting.',
      });
      setStep(3);
      return;
    }
    if (!validateDocuments()) {
      submittingRef.current = false;
      setStep(1);
      return;
    }

    setProgressMessage('Creating project…');
    try {
      const result = await createProject.mutateAsync({
        draft: {
          basics: basicsParsed.data,
          details: detailsParsed.data,
          banner: latest.banner,
          documents: latest.documents,
        },
        onProgress: setProgressMessage,
      });

      resetDraft();
      clearLocalWizardState();
      pushToast({ type: 'success', message: 'Project created successfully.' });
      router.replace(`/(tabs)/projects/${result.projectId}`);
    } catch (error) {
      pushToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project',
      });
      setProgressMessage('');
    } finally {
      submittingRef.current = false;
    }
  }, [
    createProject,
    pushToast,
    resetDraft,
    router,
    flushFormsToStore,
    validateDocuments,
    setStep,
    clearLocalWizardState,
  ]);

  const onButtonPress = useCallback(() => {
    if (isLastStep) handleSubmit();
    else goNext();
  }, [isLastStep, handleSubmit, goNext]);

  if (!hydrated) {
    return (
      <ScreenLayout>
        <Spinner label="Loading draft…" />
      </ScreenLayout>
    );
  }

  if (createProject.isPending) {
    return (
      <ScreenLayout>
        <Spinner label={progressMessage || 'Creating project…'} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Pressable
          onPress={saveAndExit}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close wizard"
        >
          <Ionicons name="close" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>
          NEW PROJECT · STEP {step} OF 4
        </Text>
        <View style={styles.closeBtn} />
      </View>

      <Text style={[styles.wizardTitle, { color: palette.text }]}>{heading.title}</Text>
      <Text style={[styles.wizardSubtitle, { color: palette.textSecondary }]}>
        {heading.subtitle}
      </Text>

      <StepIndicator steps={STEPS} currentStep={step} />

      <KeyboardAvoidingScreen scrollViewRef={scrollViewRef as React.RefObject<ScrollView>}>
        <View style={styles.column}>
          {step === 1 ? (
            <CreateProjectStepUpload
              brief={uploadedBrief}
              extractedFields={autoFilledFields}
              extractionNotes={extractionNotes}
              onBusyChange={setUploadBusy}
              onExtracted={(extracted, uploaded, filled) => {
                setUploadedBrief(uploaded);
                setExtractionNotes(extracted.confidence?.notes ?? '');
                setAutoFilledFields(filled);
              }}
            />
          ) : null}
          {step === 2 ? (
            <>
              {autoFilledFields.length > 0 ? (
                <View
                  style={[
                    styles.autoFillBanner,
                    {
                      backgroundColor: palette.semantic.success.bg,
                      borderColor: palette.semantic.success.border,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={14} color={palette.semantic.success.fg} />
                  <Text style={[styles.autoFillText, { color: palette.semantic.success.fg }]}>
                    {autoFilledFields.length} field{autoFilledFields.length === 1 ? '' : 's'}{' '}
                    auto-filled from your brief. Review and edit anything you'd like to change.
                  </Text>
                </View>
              ) : null}
              <CreateProjectStepBasics methods={basicsMethods} />
            </>
          ) : null}
          {step === 3 ? (
            <>
              {autoFilledFields.length > 0 ? (
                <View
                  style={[
                    styles.autoFillBanner,
                    {
                      backgroundColor: palette.semantic.success.bg,
                      borderColor: palette.semantic.success.border,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={14} color={palette.semantic.success.fg} />
                  <Text style={[styles.autoFillText, { color: palette.semantic.success.fg }]}>
                    Financial terms and long-form fields were auto-filled — you can adjust anything
                    below.
                  </Text>
                </View>
              ) : null}
              <CreateProjectStepDetails methods={detailsMethods} />
            </>
          ) : null}
          {step === 4 ? <CreateProjectStepReview progressMessage={progressMessage} /> : null}
          <View style={styles.navRow}>
            {step > 1 ? (
              <Button title="Back" onPress={goBack} variant="outline" style={styles.btn} />
            ) : null}
            <Button
              title={buttonTitle}
              onPress={onButtonPress}
              disabled={step === 1 && uploadBusy}
              style={styles.btn}
            />
          </View>
        </View>
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  // Keep the wizard column readable on wide desktop viewports.
  column: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
  },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btn: { marginTop: spacing.md, flexGrow: 1, minWidth: 130 },
  closeBtn: { width: 32, alignItems: 'center' },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  wizardTitle: {
    fontFamily: typography.families.display,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.7,
    marginBottom: spacing.xs,
  },
  wizardSubtitle: {
    fontSize: typography.sizes.sm,
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  autoFillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  autoFillText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    lineHeight: 18,
  },
});
