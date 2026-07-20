import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInputProps } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { FormProvider, UseFormReturn, useWatch } from 'react-hook-form';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { useUiStore } from '@/src/store/useUiStore';
import { BANNER_MIME_TYPES } from '@/src/utils/files';
import { typography } from '@/src/constants/typography';
import { FormInput } from '@/src/components/form/FormInput';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { ProjectBasicsFormValues } from '@/src/schemas/project.schema';
import { DURATION_UNIT_LABELS, type DurationUnit } from '@/src/types/project.types';

const DURATION_UNITS: DurationUnit[] = ['MONTHS', 'WEEKS', 'DAYS'];

export function CreateProjectStepBasics({
  methods,
}: {
  methods: UseFormReturn<ProjectBasicsFormValues>;
}) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const banner = useProjectDraftStore((s) => s.draft.banner);
  const setBasics = useProjectDraftStore((s) => s.setBasics);
  const setBanner = useProjectDraftStore((s) => s.setBanner);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Validate on mount so a resumed draft immediately re-enables the Continue button.
    methods.trigger();
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      pushToast({ type: 'error', message: 'Permission to access media library is required.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
    });
    // const result = await DocumentPicker.getDocumentAsync({
    //   type: BANNER_MIME_TYPES,
    //   copyToCacheDirectory: true,
    //   multiple: false,
    // });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.mimeType || !BANNER_MIME_TYPES.includes(asset.mimeType)) {
      pushToast({ type: 'error', message: 'Please choose a JPEG, PNG, or WebP image.' });
      return;
    }
    setBanner({
      uri: asset.uri,
      fileName: asset.fileName ?? 'banner.jpg',
      mimeType: asset.mimeType,
      sizeBytes: asset.fileSize ?? 0,
    });
  };

  const durationUnit = useWatch({ control: methods.control, name: 'durationUnit' });

  const inputStyle = [
    styles.input,
    { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
  ];

  const RenderDurationUnit = () => (
    <View style={styles.unitRow}>
      {DURATION_UNITS.map((unit) => (
        <Pressable
          key={unit}
          onPress={() =>
            methods.setValue('durationUnit', unit, {
              shouldValidate: true,
              shouldDirty: true,
              shouldTouch: true,
            })
          }
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
  );

  const inputFields: (TextInputProps & {
    label: string;
    name: string;
    renderRight?: React.ReactNode;
  })[] = [
    {
      label: 'Project Name',
      name: 'name',
      placeholder: 'Enter project name',
      autoCapitalize: 'words',
    },
    { label: 'Sector', name: 'sector', placeholder: 'Enter sector' },
    {
      label: 'Location',
      name: 'location',
      placeholder: 'Enter location',
      autoComplete: 'address-line1',
    },
    {
      label: 'Duration',
      name: 'durationValue',
      placeholder: 'Enter duration',
      keyboardType: 'numeric',
      renderRight: <RenderDurationUnit />,
    },
    {
      label: 'Target amount (₦)',
      name: 'targetAmount',
      placeholder: 'Enter target amount',
      keyboardType: 'decimal-pad',
    },
  ];

  return (
    <View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormProvider {...methods}>
          <View style={styles.form}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>
              Banner image <Text style={{ color: palette.muted }}>(optional)</Text>
            </Text>
            <Pressable
              onPress={pickBanner}
              style={[
                styles.bannerSlot,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
            >
              {banner ? (
                <Image source={{ uri: banner.uri }} style={styles.bannerPreview} />
              ) : (
                <Text style={[styles.bannerHint, { color: palette.muted }]}>
                  Tap to upload cover image (optional)
                </Text>
              )}
            </Pressable>
            {inputFields.map((field) => (
              <View key={field.name} style={{ gap: spacing.xs }}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>{field.label}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <FormInput
                      name={field.name}
                      style={inputStyle}
                      placeholder={field.placeholder}
                      keyboardType={field.keyboardType as any}
                    />
                  </View>
                  {field.renderRight}
                </View>
              </View>
            ))}
          </View>
        </FormProvider>
      </ScrollView>

      {/* {step === 4 ? (
        <Text style={[styles.footerNote, { color: palette.muted }]}>
          Your project will be reviewed by the CEO.
        </Text>
      ) : null} */}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.md },
  form: { gap: spacing.xs },
  label: { fontSize: typography.sizes.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: typography.sizes.sm },
  //
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
  durationValue: { flex: 1 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  unitChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
});
