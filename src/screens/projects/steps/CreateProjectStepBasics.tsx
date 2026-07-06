import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectBasicsSchema, type ProjectBasicsFormValues } from '@/src/schemas/project.schema';
import { FormInput } from '@/src/components/form/FormInput';
import { CreateProjectStepLayout } from '@/src/components/projects/CreateProjectStepLayout';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { spacing } from '@/src/constants/spacing';

type Props = {
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
};

export function CreateProjectStepBasics({ onNext, onBack, onSaveExit }: Props) {
  const basics = useProjectDraftStore((s) => s.draft.basics);
  const setBasics = useProjectDraftStore((s) => s.setBasics);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = useForm<ProjectBasicsFormValues>({
    resolver: zodResolver(projectBasicsSchema) as Resolver<ProjectBasicsFormValues>,
    defaultValues: basics,
    mode: 'onBlur',
  });

  useEffect(() => {
    const subscription = methods.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setBasics(values as ProjectBasicsFormValues);
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [methods, setBasics]);

  const handleNext = methods.handleSubmit((values) => {
    setBasics(values);
    onNext();
  });

  const handleSaveExit = () => {
    setBasics(methods.getValues());
    onSaveExit();
  };

  return (
    <CreateProjectStepLayout
      step={1}
      title="Project basics"
      subtitle="Name, sector, location, and funding target."
      onBack={onBack}
      onNext={handleNext}
      onSaveExit={handleSaveExit}
      showBack={false}
    >
      <FormProvider {...methods}>
        <View style={styles.form}>
          <FormInput name="name" label="Project name" />
          <FormInput name="sector" label="Sector" />
          <FormInput name="location" label="Location" />
          <FormInput name="targetNaira" label="Target amount (₦)" keyboardType="decimal-pad" />
        </View>
      </FormProvider>
    </CreateProjectStepLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
});
