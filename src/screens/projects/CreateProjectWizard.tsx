import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

/** Catch render crashes so create never paints a silent white screen. */
class WizardErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScreenLayout>
          <View style={{ padding: 24, gap: 12, maxWidth: FORM_MAX_WIDTH }}>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>Couldn’t open the wizard</Text>
            <Text style={{ fontSize: 14, opacity: 0.7 }}>
              {this.state.error.message || 'Something went wrong loading create project.'}
            </Text>
            <Button
              title="Clear draft and retry"
              onPress={() => {
                this.props.onReset();
                this.setState({ error: null });
              }}
            />
          </View>
        </ScreenLayout>
      );
    }
    return this.props.children;
  }
}

function CreateProjectWizardInner() {
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
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [uploadedBrief, setUploadedBrief] = useState<UploadedBrief | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [extractionNotes, setExtractionNotes] = useState<string>('');
  const [uploadBusy, setUploadBusy] = useState(false);

  const basicsMethods = useForm<ProjectBasicsFormValues>({
    resolver: zodResolver(projectBasicsSchema) as Resolver<ProjectBasicsFormValues>,
    defaultValues: draft.basics,
    mode: 'onTouched',
  });

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
    for (const doc of current.documents ?? []) {
      if (doc.cacheKey) clearBriefCache(doc.cacheKey);
    }
    if (current.banner?.cacheKey) clearBannerCache(current.banner.cacheKey);
    const fresh = resetDraft();
    clearLocalWizardState();
    basicsMethods.reset(fresh.basics);
    detailsMethods.reset(fresh.details);
    setShowResumeBanner(false);
  }, [resetDraft, clearLocalWizardState, basicsMethods, detailsMethods]);

  const loadDraft = useCallback(() => {
    const current = useProjectDraftStore.getState().draft;
    basicsMethods.reset(current.basics);
    detailsMethods.reset(current.details);
    const overview = current.documents?.find((d) => d.kind === 'OVERVIEW');
    if (overview) setUploadedBrief(briefFromDraftDoc(overview));
    setShowResumeBanner(false);
  }, [basicsMethods, detailsMethods]);

  useEffect(() => {
    if (role && !canCreateProject(role)) {
      pushToast({
        type: 'info',
        message: 'Only Prism Line Managers, CEO, and Admins can create projects.',
      });
      router.replace('/(tabs)/projects' as never);
    }
  }, [role, router, pushToast]);

  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  // Never block the whole screen on persist hydration — apply resume after
  // rehydrate finishes (or after a short timeout if hydration stalls).
  useEffect(() => {
    if (resumeChecked) return;
    let cancelled = false;

    const finish = () => {
      if (cancelled || resumeChecked) return;
      setResumeChecked(true);
      try {
        if (hasDraft()) setShowResumeBanner(true);
        else loadDraft();
      } catch {
        startFresh();
      }
    };

    const unsub = useProjectDraftStore.persist.onFinishHydration(finish);
    if (useProjectDraftStore.persist.hasHydrated()) finish();
    const timeout = setTimeout(finish, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsub?.();
    };
  }, [resumeChecked, hasDraft, loadDraft, startFresh]);

  const validateDocuments = useCallback((): boolean => {
    const documents = useProjectDraftStore.getState().draft.documents ?? [];
    for (const slot of REQUIRED_SLOTS) {
      if (!documents.find((d) => d.kind === slot.kind)) {
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

  const safeStep = (step === 1 || step === 2 || step === 3 || step === 4 ? step : 1) as
    | 1
    | 2
    | 3
    | 4;
  const isLastStep = safeStep === 4;
  const buttonTitle = isLastStep
    ? role === 'CEO' || role === 'ADMIN'
      ? 'Submit'
      : 'Submit for Approval'
    : 'Continue';

  const roleHint =
    role === 'CEO' || role === 'ADMIN'
      ? 'As CEO/Admin, this project will be auto-approved.'
      : 'As Line Manager, this project will be submitted for CEO approval after upload.';

  const heading = isLastStep
    ? { title: 'Review', subtitle: roleHint }
    : (STEP_HEADINGS[safeStep - 1] ?? STEP_HEADINGS[0]);

  const goBack = useCallback(() => {
    flushFormsToStore();
    if (safeStep > 1) setStep((safeStep - 1) as 1 | 2 | 3 | 4);
    else router.back();
  }, [safeStep, setStep, router, flushFormsToStore]);

  const goNext = useCallback(async () => {
    const current = useProjectDraftStore.getState().draft;
    if (safeStep === 1) {
      const hasBrief = (current.documents ?? []).some((d) => d.kind === 'OVERVIEW');
      if (!hasBrief) {
        pushToast({
          type: 'error',
          message: 'Please upload your project brief before continuing.',
        });
        return;
      }
      basicsMethods.reset(current.basics);
      detailsMethods.reset(current.details);
    }
    if (safeStep === 2) {
      const ok = await basicsMethods.trigger();
      if (!ok) {
        const values = basicsMethods.getValues();
        (Object.keys(values) as (keyof typeof values)[]).forEach((k) => {
          basicsMethods.setValue(k, values[k], { shouldTouch: true });
        });
        pushToast({ type: 'error', message: 'Please complete all required fields.' });
        return;
      }
      setBasicsInStore(basicsMethods.getValues());
    }
    if (safeStep === 3) {
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
      if (!validateDocuments()) return;
    }
    if (safeStep < 4) setStep((safeStep + 1) as 1 | 2 | 3 | 4);
  }, [
    safeStep,
    setStep,
    basicsMethods,
    detailsMethods,
    validateDocuments,
    pushToast,
    setBasicsInStore,
    setDetailsInStore,
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
    if (isLastStep) void handleSubmit();
    else void goNext();
  }, [isLastStep, handleSubmit, goNext]);

  if (createProject.isPending) {
    return (
      <ScreenLayout>
        <Spinner label={progressMessage || 'Creating project…'} />
      </ScreenLayout>
    );
  }

  // Match CreateUser: one ScrollView owns the whole form so web never
  // collapses nested flex scenes to a blank viewport.
  return (
    <ScreenLayout>
      <KeyboardAvoidingScreen scrollViewRef={scrollViewRef as React.RefObject<ScrollView>}>
        <View style={styles.column}>
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
              NEW PROJECT · STEP {safeStep} OF 4
            </Text>
            <View style={styles.closeBtn} />
          </View>

          <Text style={[styles.wizardTitle, { color: palette.text }]}>{heading.title}</Text>
          <Text style={[styles.wizardSubtitle, { color: palette.textSecondary }]}>
            {heading.subtitle}
          </Text>

          {showResumeBanner ? (
            <View
              style={[
                styles.resumeBanner,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.resumeTitle, { color: palette.text }]}>Resume draft?</Text>
              <Text style={[styles.resumeMsg, { color: palette.textSecondary }]}>
                You have an unfinished project draft. Continue editing, or start fresh.
              </Text>
              <View style={styles.resumeActions}>
                <Button
                  title="Start fresh"
                  variant="outline"
                  onPress={startFresh}
                  style={styles.resumeBtn}
                />
                <Button title="Continue" onPress={loadDraft} style={styles.resumeBtn} />
              </View>
            </View>
          ) : null}

          <StepIndicator steps={STEPS} currentStep={safeStep} />

          {safeStep === 1 ? (
            <CreateProjectStepUpload
              brief={uploadedBrief}
              extractedFields={autoFilledFields}
              extractionNotes={extractionNotes}
              onBusyChange={setUploadBusy}
              onExtracted={(_extracted, uploaded, filled) => {
                setUploadedBrief(uploaded);
                setExtractionNotes(_extracted.confidence?.notes ?? '');
                setAutoFilledFields(filled);
              }}
            />
          ) : null}

          {safeStep === 2 ? (
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
                    auto-filled from your brief. Review and edit anything you&apos;d like to change.
                  </Text>
                </View>
              ) : null}
              <CreateProjectStepBasics methods={basicsMethods} />
            </>
          ) : null}

          {safeStep === 3 ? (
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

          {safeStep === 4 ? <CreateProjectStepReview progressMessage={progressMessage} /> : null}

          <View style={styles.navRow}>
            {safeStep > 1 ? (
              <Button title="Back" onPress={goBack} variant="outline" style={styles.btn} />
            ) : null}
            <Button
              title={buttonTitle}
              onPress={onButtonPress}
              disabled={safeStep === 1 && uploadBusy}
              style={styles.btn}
            />
          </View>
        </View>
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

export default function CreateProjectWizard() {
  return (
    <WizardErrorBoundary
      onReset={() => {
        useProjectDraftStore.getState().resetDraft();
      }}
    >
      <CreateProjectWizardInner />
    </WizardErrorBoundary>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  resumeBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  resumeTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  resumeMsg: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  resumeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  resumeBtn: {
    flexGrow: 1,
    minWidth: 120,
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
