import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { UploadedBrief } from '@/src/services/briefExtraction.services';

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

export default function CreateProjectWizard() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const scrollViewRef = useRef<ScrollView>(null);
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
  const [uploadedBrief, setUploadedBrief] = useState<UploadedBrief | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [extractionNotes, setExtractionNotes] = useState<string>('');

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

  const validateDocuments = (): boolean => {
    const documents = draft.documents;
    for (const slot of REQUIRED_SLOTS) {
      const doc = documents.find((d) => d.kind === slot.kind);
      if (!doc) {
        pushToast({ type: 'error', message: `${slot.title} is required.` });
        return false;
      }
    }
    return true;
  };

  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const isLastStep = step === 4;
  const buttonTitle = isLastStep
    ? `Submit ${role === 'CEO' || role === 'ADMIN' ? '' : 'for Approval'}`
    : 'Continue';

  const roleHint =
    role === 'CEO' || role === 'ADMIN'
      ? 'As CEO/Admin, this project will be auto-approved.'
      : 'As Line Manager, this project will be submitted for CEO approval after upload.';

  const heading = isLastStep ? { title: 'Review', subtitle: roleHint } : STEP_HEADINGS[step - 1];

  const loadDraft = () => {
    // const draft = resetDraft();
    basicsMethods.reset(draft.basics);
    detailsMethods.reset(draft.details);
  };

  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  useEffect(() => {
    if (resumeChecked) return;
    setResumeChecked(true);

    if (hasDraft()) {
      Alert.alert('Resume draft?', 'You have an unfinished project draft.', [
        { text: 'Start fresh', style: 'destructive', onPress: resetDraft },
        { text: 'Continue', onPress: loadDraft },
      ]);
    }
  }, [hasDraft, resetDraft, resumeChecked]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
    else router.back();
  }, [step, setStep, router]);

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
    pushToast({ type: 'info', message: 'Draft saved.' });
    router.back();
  }, [pushToast, router]);

  const handleSubmit = useCallback(async () => {
    setProgressMessage('Creating project…');
    try {
      const result = await createProject.mutateAsync({
        draft: {
          basics: draft.basics,
          details: draft.details,
          banner: draft.banner,
          documents: draft.documents,
        },
        onProgress: setProgressMessage,
      });

      resetDraft();

      if (result.failedDocuments.length > 0) {
        pushToast({
          type: 'info',
          message: `Project created. ${result.failedDocuments.length} document(s) failed to upload.`,
        });
      } else {
        pushToast({ type: 'success', message: 'Project created successfully.' });
      }

      router.replace(`/(tabs)/projects/${result.projectId}`);
    } catch (error) {
      pushToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project',
      });
      setProgressMessage('');
    }
  }, [createProject, draft, pushToast, resetDraft, router]);

  const onButtonPress = useCallback(() => {
    if (isLastStep) handleSubmit();
    else goNext();
  }, [isLastStep, handleSubmit, goNext]);

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
            <Button title={buttonTitle} onPress={onButtonPress} style={styles.btn} />
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
