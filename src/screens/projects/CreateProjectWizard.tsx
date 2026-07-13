import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
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

export default function CreateProjectWizard() {
  const router = useRouter();
  const step = useProjectDraftStore((s) => s.draft.step);
  const setStep = useProjectDraftStore((s) => s.setStep);
  const draft = useProjectDraftStore((s) => s.draft);
  const hasDraft = useProjectDraftStore((s) => s.hasDraft);
  const resetDraft = useProjectDraftStore((s) => s.resetDraft);
  const createProject = useCreateProjectWithDocuments();
  const pushToast = useUiStore((s) => s.pushToast);
  const [progressMessage, setProgressMessage] = useState('');
  const [resumeChecked, setResumeChecked] = useState(false);

  useEffect(() => {
    if (resumeChecked) return;
    setResumeChecked(true);

    if (hasDraft()) {
      Alert.alert('Resume draft?', 'You have an unfinished project draft.', [
        { text: 'Start fresh', style: 'destructive', onPress: () => resetDraft() },
        { text: 'Continue', onPress: () => {} },
      ]);
    }
  }, [hasDraft, resetDraft, resumeChecked]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
    else router.back();
  }, [step, setStep, router]);

  const goNext = useCallback(() => {
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
  }, [step, setStep]);

  const saveAndExit = useCallback(() => {
    pushToast({ type: 'info', message: 'Draft saved.' });
    router.back();
  }, [pushToast, router]);

  const handleSubmit = async () => {
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
  };

  if (createProject.isPending) {
    return (
      <ScreenLayout>
        <Spinner label={progressMessage || 'Creating project…'} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {step === 1 ? (
        <CreateProjectStepBasics onNext={goNext} onBack={goBack} onSaveExit={saveAndExit} />
      ) : null}
      {step === 2 ? (
        <CreateProjectStepDetails onNext={goNext} onBack={goBack} onSaveExit={saveAndExit} />
      ) : null}
      {step === 3 ? (
        <CreateProjectStepDocuments onNext={goNext} onBack={goBack} onSaveExit={saveAndExit} />
      ) : null}
      {step === 4 ? (
        <CreateProjectStepReview
          onBack={goBack}
          onSubmit={handleSubmit}
          submitting={createProject.isPending}
          progressMessage={progressMessage}
        />
      ) : null}
    </ScreenLayout>
  );
}
