import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { createProjectOwner } from '@/src/services/projectOps.services';
import { formatResendCountdown, markOwnerInviteSent } from '@/src/utils/ownerInviteCooldown';
import { useOwnerInviteCooldown } from '@/src/hooks/projects/useOwnerInviteCooldown';
import { canAssignProjectOwner, isPrismOperator } from '@/src/helpers/guards';
import type { Role } from '@/src/constants/roles';
import type { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
  role: Role | null;
  userId?: string;
  ownerEmail: string;
  ownerName: string;
  ownerBusy: boolean;
  exportBusy: boolean;
  setOwnerEmail: (v: string) => void;
  setOwnerName: (v: string) => void;
  setOwnerBusy: (v: boolean) => void;
  onMessageOwner: () => void;
  onExportCapex: () => void;
  onRefetch: () => void;
};

export function ProjectOwnerPanel({
  project,
  role,
  userId,
  ownerEmail,
  ownerName,
  ownerBusy,
  exportBusy,
  setOwnerEmail,
  setOwnerName,
  setOwnerBusy,
  onMessageOwner,
  onExportCapex,
  onRefetch,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const { remainingMs: ownerResendRemainingMs, refresh: refreshOwnerResend } =
    useOwnerInviteCooldown(project.id);

  if (!isPrismOperator(role) && !canAssignProjectOwner(role)) return null;

  const canManageOwner =
    canAssignProjectOwner(role) &&
    (project.createdBy?.id === userId || role === 'CEO' || role === 'ADMIN');

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        Project owner (originator)
      </Text>
      {project.projectOwnerId && project.projectOwner ? (
        <View style={{ gap: spacing.sm }}>
          <View
            style={[
              styles.copyLinkBtn,
              {
                borderColor: palette.border,
                backgroundColor: palette.surfaceMuted,
                alignSelf: 'stretch',
                justifyContent: 'flex-start',
              },
            ]}
          >
            <Ionicons name="person-outline" size={14} color={palette.primary} />
            <Text style={[styles.bodyText, { color: palette.text, flex: 1 }]}>
              {project.projectOwner.full_name}
              {project.projectOwner.email ? ` · ${project.projectOwner.email}` : ''}
            </Text>
          </View>
          {canManageOwner && project.projectOwner.email ? (
            <Button
              title={
                ownerResendRemainingMs > 0
                  ? `Resend available in ${formatResendCountdown(ownerResendRemainingMs)}`
                  : 'Resend invite email'
              }
              variant="outline"
              loading={ownerBusy}
              disabled={ownerBusy || ownerResendRemainingMs > 0}
              onPress={async () => {
                setOwnerBusy(true);
                try {
                  const res = await createProjectOwner({
                    projectId: project.id,
                    email: project.projectOwner!.email!.trim(),
                    fullName: project.projectOwner!.full_name.trim(),
                    resend: true,
                  });
                  markOwnerInviteSent(project.id);
                  refreshOwnerResend();
                  if (res.emailSent) {
                    pushToast({
                      type: 'success',
                      message: `Invite re-sent to ${res.email}. You can resend again in 5 minutes if needed.`,
                    });
                  } else {
                    const codeHint = res.signinCode ? ` Sign-in code: ${res.signinCode}` : '';
                    const errHint = res.emailError ? ` (${res.emailError})` : '';
                    pushToast({
                      type: 'error',
                      message: `Email failed.${codeHint}${errHint}`,
                    });
                  }
                } catch (err) {
                  pushToast({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Could not resend invite',
                  });
                } finally {
                  setOwnerBusy(false);
                }
              }}
            />
          ) : null}
        </View>
      ) : (
        <Text style={[styles.helper, { color: palette.muted }]}>
          No project owner linked yet. Prism creates their login for this project.
        </Text>
      )}
      {canManageOwner && !project.projectOwnerId ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            label="Owner full name"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCapitalize="words"
          />
          <TextInput
            label="Owner email"
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title="Create / assign owner"
            loading={ownerBusy}
            disabled={ownerName.trim().length < 2 || !ownerEmail.trim().includes('@')}
            onPress={async () => {
              setOwnerBusy(true);
              try {
                const res = await createProjectOwner({
                  projectId: project.id,
                  email: ownerEmail.trim(),
                  fullName: ownerName.trim(),
                });
                markOwnerInviteSent(project.id);
                refreshOwnerResend();
                if (res.emailSent) {
                  pushToast({
                    type: 'success',
                    message: `Invite emailed to ${res.email}`,
                  });
                } else {
                  const codeHint = res.signinCode ? ` Sign-in code: ${res.signinCode}` : '';
                  const errHint = res.emailError ? ` (${res.emailError})` : '';
                  pushToast({
                    type: 'error',
                    message: `Owner linked but email failed.${codeHint}${errHint}`,
                  });
                }
                setOwnerEmail('');
                setOwnerName('');
                onRefetch();
              } catch (err) {
                pushToast({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Could not assign owner',
                });
              } finally {
                setOwnerBusy(false);
              }
            }}
          />
        </View>
      ) : null}

      {project.projectOwnerId &&
      (project.createdBy?.id === userId || role === 'CEO' || role === 'ADMIN') ? (
        <Pressable
          onPress={onMessageOwner}
          style={[
            styles.copyLinkBtn,
            {
              borderColor: palette.border,
              backgroundColor: palette.surfaceMuted,
              alignSelf: 'flex-start',
            },
          ]}
          data-testid="message-project-owner-btn"
          accessibilityRole="button"
          accessibilityLabel="Message project owner"
        >
          <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
          <Text
            style={{
              color: palette.primary,
              fontSize: typography.sizes.xs,
              fontWeight: '600',
            }}
          >
            Message project owner
          </Text>
        </Pressable>
      ) : null}

      {isPrismOperator(role) || role === 'CEO' || role === 'ADMIN' ? (
        <Button
          title={exportBusy ? 'Exporting…' : 'Export CapEx report'}
          variant="outline"
          loading={exportBusy}
          onPress={onExportCapex}
          data-testid="export-capex-btn"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  bodyText: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  helper: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
