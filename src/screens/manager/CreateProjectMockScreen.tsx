import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { Button } from '@/src/components/ui/Button';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

const STEPS = ['Basics', 'Details', 'Documents', 'Review'];

const STEP_HEADINGS = [
  { title: 'Basics', subtitle: "Let's start with the basic information about your project." },
  { title: 'Details', subtitle: 'Add financial details and a short description.' },
  { title: 'Documents', subtitle: 'Upload required documents for CEO review.' },
  { title: 'Review', subtitle: 'Review your project before submitting.' },
];

const DOCS = ['Project Overview', 'Fund Use Statement', 'Risk Assessment', 'Key Decision'];

export default function CreateProjectMockScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('Lagos Last-Mile Logistics');
  const [sector, setSector] = useState('Logistics & Transportation');
  const [location, setLocation] = useState('Lagos State, Nigeria');
  const [duration, setDuration] = useState('12 months');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('15000000');
  const [roi, setRoi] = useState('18');

  const inputStyle = [
    styles.input,
    { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
  ];
  const heading = STEP_HEADINGS[step - 1];

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Create New Project</Text>
        <View style={styles.closeBtn} />
      </View>

      <StepIndicator steps={STEPS} currentStep={step} />

      <Text style={[styles.stepTitle, { color: palette.text }]}>{heading.title}</Text>
      <Text style={[styles.stepSubtitle, { color: palette.textSecondary }]}>{heading.subtitle}</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Project Name</Text>
            <TextInput style={inputStyle} value={name} onChangeText={setName} />
            <Text style={[styles.label, { color: palette.textSecondary }]}>Sector</Text>
            <TextInput style={inputStyle} value={sector} onChangeText={setSector} />
            <Text style={[styles.label, { color: palette.textSecondary }]}>Location</Text>
            <TextInput style={inputStyle} value={location} onChangeText={setLocation} />
            <Text style={[styles.label, { color: palette.textSecondary }]}>Duration</Text>
            <TextInput style={inputStyle} value={duration} onChangeText={setDuration} />
          </View>
        )}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Short Description</Text>
            <TextInput
              style={[inputStyle, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe your project..."
              placeholderTextColor={palette.muted}
            />
            <Text style={[styles.label, { color: palette.textSecondary }]}>Target Amount (₦)</Text>
            <TextInput style={inputStyle} value={target} onChangeText={setTarget} keyboardType="numeric" />
            <Text style={[styles.label, { color: palette.textSecondary }]}>Projected Profit (%)</Text>
            <TextInput style={inputStyle} value={roi} onChangeText={setRoi} keyboardType="numeric" />
          </View>
        )}
        {step === 3 && (
          <View style={styles.form}>
            {DOCS.map((doc) => (
              <View
                key={doc}
                style={[styles.docSlot, { borderColor: palette.border, backgroundColor: palette.surface }]}
              >
                <Ionicons name="document-outline" size={18} color={palette.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docName, { color: palette.text }]}>{doc}</Text>
                  <Text style={[styles.docHint, { color: palette.muted }]}>PDF, DOC (Max 10MB)</Text>
                </View>
                <Button title="Upload" variant="outline" size="sm" onPress={() => {}} />
              </View>
            ))}
          </View>
        )}
        {step === 4 && (
          <View style={[styles.review, { borderColor: palette.border }]}>
            {[
              ['Name', name],
              ['Sector', sector],
              ['Location', location],
              ['Duration', duration],
              ['Target', `₦${Number(target).toLocaleString()}`],
              ['ROI', `${roi}%`],
              ['Documents', '4 uploaded'],
            ].map(([k, v]) => (
              <View key={k} style={[styles.reviewRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.reviewKey, { color: palette.textSecondary }]}>{k}</Text>
                <Text style={[styles.reviewVal, { color: palette.text }]}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {step > 1 ? (
          <Button title="Back" variant="outline" onPress={() => setStep((s) => s - 1)} style={styles.btn} />
        ) : null}
        {step < 4 ? (
          <Button title="Continue" onPress={() => setStep((s) => s + 1)} style={styles.btn} />
        ) : (
          <Button
            title="Submit for Approval"
            onPress={() => {
              pushToast({ type: 'success', message: 'Project submitted for CEO review' });
              router.back();
            }}
            style={styles.btn}
          />
        )}
      </View>
      {step === 4 ? (
        <Text style={[styles.footerNote, { color: palette.muted }]}>
          Your project will be reviewed by the CEO.
        </Text>
      ) : null}
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
  closeBtn: { width: 32, alignItems: 'center' },
  headerTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  stepTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, marginBottom: 4 },
  stepSubtitle: { fontSize: typography.sizes.xs, marginBottom: spacing.md },
  scroll: { paddingBottom: spacing.md },
  form: { gap: spacing.xs },
  label: { fontSize: typography.sizes.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: typography.sizes.sm },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  docSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  docName: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  docHint: { fontSize: 10, marginTop: 2 },
  review: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewKey: { fontSize: typography.sizes.xs },
  reviewVal: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1 },
  footerNote: { fontSize: typography.sizes.xs, textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic' },
});
