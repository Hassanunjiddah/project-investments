import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { useCreateProjectWithDocuments } from '@/src/hooks/projects/useCreateProjectWithDocuments';
import { useUiStore } from '@/src/store/useUiStore';
import { CreateProjectStepBasics } from '@/src/screens/projects/steps/CreateProjectStepBasics';
import { CreateProjectStepDetails } from '@/src/screens/projects/steps/CreateProjectStepDetails';
import { CreateProjectStepDocuments } from '@/src/screens/projects/steps/CreateProjectStepDocuments';
import { CreateProjectStepReview } from '@/src/screens/projects/steps/CreateProjectStepReview';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { colors } from '@/src/constants/colors';
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

const STEPS = ['Basics', 'Details', 'Documents', 'Review'];
const STEP_HEADINGS = [
  { title: 'Basics', subtitle: "Let's start with the basic information about your project." },
  {
    title: 'Details',
    subtitle: 'Add financial details, risks, timeline, and optional Mudarabah terms.',
  },
  { title: 'Documents', subtitle: 'Upload required documents for CEO review.' },
  { title: 'Review', subtitle: 'Review your project before submitting.' },
];

export const REQUIRED_SLOTS: { kind: DocKind; title: string }[] = [
  { kind: 'OVERVIEW', title: 'Project Overview' },
  { kind: 'RISK', title: 'Risk Assessment' },
  { kind: 'DECISION', title: 'Key Decision' },
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
  const createProject = useCreateProjectWithDocuments();
  const pushToast = useUiStore((s) => s.pushToast);
  const [progressMessage, setProgressMessage] = useState('');
  const [resumeChecked, setResumeChecked] = useState(false);

  //Step 1 schema
  const basicsMethods = useForm<ProjectBasicsFormValues>({
    resolver: zodResolver(projectBasicsSchema) as Resolver<ProjectBasicsFormValues>,
    defaultValues: {},
    mode: 'onChange',
  });

  //Step 2 schema
  const detailsMethods = useForm<ProjectDetailsFormValues>({
    resolver: zodResolver(projectDetailsSchema) as Resolver<ProjectDetailsFormValues>,
    defaultValues: draft.details,
    mode: 'onChange',
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

  //Can proceed to next step
  const canProceedToNextStep = () => {
    if (step === 1) return basicsMethods.formState.isValid;
    if (step === 2) return detailsMethods.formState.isValid;
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

  const goNext = useCallback(() => {
    if (step === 3) {
      if (!validateDocuments()) return;
    }
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
  }, [step, setStep, validateDocuments]);

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
        <Pressable onPress={saveAndExit} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Create New Project</Text>
        <View style={styles.closeBtn} />
      </View>
      <StepIndicator steps={STEPS} currentStep={step} />
      <Text style={[styles.stepTitle, { color: palette.text }]}>{heading.title}</Text>
      <Text style={[styles.stepSubtitle, { color: palette.textSecondary }]}>
        {heading.subtitle}
      </Text>
      <KeyboardAvoidingScreen scrollViewRef={scrollViewRef as React.RefObject<ScrollView>}>
        {step === 1 ? <CreateProjectStepBasics methods={basicsMethods} /> : null}
        {step === 2 ? <CreateProjectStepDetails methods={detailsMethods} /> : null}
        {step === 3 ? <CreateProjectStepDocuments /> : null}
        {step === 4 ? <CreateProjectStepReview progressMessage={progressMessage} /> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {step > 1 ? (
            <Button title="Back" onPress={goBack} variant="outline" style={styles.btn} />
          ) : null}
          <Button
            title={buttonTitle}
            onPress={onButtonPress}
            style={styles.btn}
            disabled={!canProceedToNextStep()}
          />
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
    marginBottom: spacing.sm,
  },
  btn: { marginTop: spacing.md, flexGrow: 1 },
  closeBtn: { width: 32, alignItems: 'center' },
  headerTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  stepTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  stepSubtitle: { fontSize: typography.sizes.xs, marginBottom: spacing.md },
});
