import { useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectBasicsSchema, type ProjectBasicsFormValues } from '@/src/schemas/project.schema';
import { FormInput } from '@/src/components/form/FormInput';
import { CreateProjectStepLayout } from '@/src/components/projects/CreateProjectStepLayout';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { useUiStore } from '@/src/store/useUiStore';
import { BANNER_MIME_TYPES } from '@/src/utils/files';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { DURATION_UNIT_LABELS } from '@/src/types/project.types';
import type { DurationUnit } from '@/src/types/project.types';

type Props = {
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
};

const DURATION_UNITS: DurationUnit[] = ['MONTHS', 'WEEKS', 'DAYS'];

export function CreateProjectStepBasics({ onNext, onBack, onSaveExit }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const basics = useProjectDraftStore((s) => s.draft.basics);
  const banner = useProjectDraftStore((s) => s.draft.banner);
  const setBasics = useProjectDraftStore((s) => s.setBasics);
  const setBanner = useProjectDraftStore((s) => s.setBanner);
  const pushToast = useUiStore((s) => s.pushToast);
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

  const pickBanner = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: BANNER_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.mimeType || !BANNER_MIME_TYPES.includes(asset.mimeType)) {
      pushToast({ type: 'error', message: 'Please choose a JPEG, PNG, or WebP image.' });
      return;
    }
    setBanner({
      uri: asset.uri,
      fileName: asset.name ?? 'banner.jpg',
      mimeType: asset.mimeType,
      sizeBytes: asset.size ?? 0,
    });
  };

  const handleNext = methods.handleSubmit((values) => {
    if (!banner) {
      pushToast({ type: 'error', message: 'Banner image is required.' });
      return;
    }
    setBasics(values);
    onNext();
  });

  const handleSaveExit = () => {
    setBasics(methods.getValues());
    onSaveExit();
  };

  const durationUnit = methods.watch('durationUnit');

  return (
    <CreateProjectStepLayout
      step={1}
      title="Project basics"
      subtitle="Name, sector, location, banner, duration, and funding target."
      onBack={onBack}
      onNext={handleNext}
      onSaveExit={handleSaveExit}
      showBack={false}
    >
      <FormProvider {...methods}>
        <View style={styles.form}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Banner image</Text>
          <Pressable
            onPress={pickBanner}
            style={[styles.bannerSlot, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            {banner ? (
              <Image source={{ uri: banner.uri }} style={styles.bannerPreview} />
            ) : (
              <Text style={[styles.bannerHint, { color: palette.muted }]}>Tap to upload cover image</Text>
            )}
          </Pressable>

          <FormInput name="name" label="Project name" />
          <FormInput name="sector" label="Sector" />
          <FormInput name="location" label="Location" />

          <View style={styles.durationRow}>
            <View style={styles.durationValue}>
              <FormInput name="durationValue" label="Duration" keyboardType="numeric" />
            </View>
            <View style={styles.durationUnits}>
              <Text style={[styles.label, { color: palette.textSecondary }]}>Unit</Text>
              <View style={styles.unitRow}>
                {DURATION_UNITS.map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => methods.setValue('durationUnit', unit)}
                    style={[
                      styles.unitChip,
                      {
                        borderColor: durationUnit === unit ? palette.primary : palette.border,
                        backgroundColor: durationUnit === unit ? palette.primaryLight : palette.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: durationUnit === unit ? palette.primary : palette.text,
                        fontSize: typography.sizes.xs,
                      }}
                    >
                      {DURATION_UNIT_LABELS[unit]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <FormInput name="targetNaira" label="Target amount (₦)" keyboardType="decimal-pad" />
        </View>
      </FormProvider>
    </CreateProjectStepLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  label: { fontSize: typography.sizes.xs, marginBottom: spacing.xs },
  bannerSlot: {
    height: 140,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPreview: { width: '100%', height: '100%' },
  bannerHint: { fontSize: typography.sizes.sm },
  durationRow: { flexDirection: 'row', gap: spacing.md },
  durationValue: { flex: 1 },
  durationUnits: { flex: 1 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  unitChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
});
