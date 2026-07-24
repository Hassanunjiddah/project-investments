import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { supabase } from '@/src/services/supabase';

type MfaState =
  | { phase: 'idle' }
  | { phase: 'enrolling'; factorId: string; qr: string; secret: string }
  | { phase: 'verifying'; factorId: string; qr: string; secret: string; code: string; busy: boolean }
  | { phase: 'enabled' }
  | { phase: 'unavailable'; reason: string };

/**
 * Security card on the Profile screen. Surfaces:
 *   • Last sign-in timestamp (from Supabase auth session)
 *   • TOTP MFA enrollment flow (Supabase-native, no extra library)
 *
 * If the Supabase project has MFA disabled in the dashboard, the enroll
 * call fails and we show a graceful "Contact your admin" state.
 */
export function ProfileSecurityCard() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [state, setState] = useState<MfaState>({ phase: 'idle' });
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setLastSignIn(data.user?.last_sign_in_at ?? null);
    });
    // Detect existing MFA factors
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find((f) => f.status === 'verified');
      if (totp) setState({ phase: 'enabled' });
    });
  }, []);

  const startEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      setState({
        phase: 'unavailable',
        reason: /disabled|not\s+enabled|not\s+allowed/i.test(error.message)
          ? 'Two-factor authentication is currently disabled on this Prism Capital project. Ask your administrator to enable TOTP in the Supabase authentication policies.'
          : error.message,
      });
      return;
    }
    if (!data) return;
    setState({
      phase: 'enrolling',
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verify = async (code: string) => {
    if (state.phase !== 'enrolling' && state.phase !== 'verifying') return;
    const factorId = state.factorId;
    setState({ ...state, phase: 'verifying', code, busy: true });
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (chErr || !challenge) {
      setState({ phase: 'unavailable', reason: chErr?.message ?? 'Challenge failed' });
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (vErr) {
      setState({ ...state, phase: 'verifying', code, busy: false });
      return;
    }
    setState({ phase: 'enabled' });
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconTile, { backgroundColor: palette.brand[50] }]}>
          <Feather name="shield" size={16} color={palette.primary} />
        </View>
        <Text style={[styles.sectionLabel, { color: palette.text }]}>Security</Text>
      </View>

      {/* Last sign-in row */}
      {lastSignIn ? (
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Last sign-in</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {new Date(lastSignIn).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      ) : null}

      {/* MFA state */}
      <View
        style={[
          styles.mfaBlock,
          { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
        ]}
      >
        <View style={styles.mfaHead}>
          <Text style={[styles.mfaTitle, { color: palette.text }]}>
            Two-factor authentication
          </Text>
          {state.phase === 'enabled' ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: palette.semantic.success.bg,
                  borderColor: palette.semantic.success.border,
                },
              ]}
            >
              <Feather name="check" size={11} color={palette.semantic.success.fg} />
              <Text style={[styles.chipText, { color: palette.semantic.success.fg }]}>
                Enabled
              </Text>
            </View>
          ) : null}
        </View>

        {state.phase === 'idle' ? (
          <>
            <Text style={[styles.mfaMsg, { color: palette.textSecondary }]}>
              Add a second factor via an authenticator app (Google Authenticator, 1Password, Authy).
              You'll enter a 6-digit code after your password on every sign-in.
            </Text>
            <Button
              title="Enable 2FA"
              onPress={startEnroll}
              size="sm"
              data-testid="profile-enable-mfa-btn"
            />
          </>
        ) : null}

        {state.phase === 'enrolling' || state.phase === 'verifying' ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.mfaMsg, { color: palette.textSecondary }]}>
              Scan this QR code in your authenticator app, or enter the secret manually. Then type
              the 6-digit code below.
            </Text>
            {/* QR — Supabase returns as `otpauth://` URL string in some versions and as an SVG
                data-uri in others. Both work as text — we surface both for portability. */}
            <View
              style={[
                styles.qrBox,
                { backgroundColor: '#FFF', borderColor: palette.border },
              ]}
            >
              {/* @ts-expect-error web-only inline HTML */}
              <img
                src={state.qr}
                alt="MFA QR code"
                style={{ width: 160, height: 160, imageRendering: 'pixelated' }}
              />
            </View>
            <View
              style={[
                styles.secretBox,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.secretLabel, { color: palette.textSecondary }]}>
                Secret
              </Text>
              <Text style={[styles.secretVal, { color: palette.text }]} selectable>
                {state.secret}
              </Text>
            </View>
            <TextInput
              label="6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={state.phase === 'verifying' ? state.code : ''}
              onChangeText={(v) => verify(v.replace(/\D/g, '').slice(0, 6))}
              data-testid="profile-mfa-verify-input"
            />
          </View>
        ) : null}

        {state.phase === 'enabled' ? (
          <Text style={[styles.mfaMsg, { color: palette.textSecondary }]}>
            Two-factor authentication is protecting this account. Keep your backup codes safe.
          </Text>
        ) : null}

        {state.phase === 'unavailable' ? (
          <View
            style={[
              styles.warn,
              {
                backgroundColor: palette.semantic.warning.bg,
                borderColor: palette.semantic.warning.border,
              },
            ]}
          >
            <Feather name="alert-triangle" size={14} color={palette.semantic.warning.fg} />
            <Text style={[styles.warnText, { color: palette.semantic.warning.fg }]}>
              {state.reason}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  mfaBlock: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  mfaHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mfaTitle: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  mfaMsg: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  qrBox: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  secretBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  secretLabel: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  secretVal: {
    fontFamily: typography.families.mono,
    fontSize: typography.sizes.sm,
    letterSpacing: 1,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  warnText: {
    flex: 1,
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
});
