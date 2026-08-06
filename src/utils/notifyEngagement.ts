import { Platform } from 'react-native';

/**
 * Soft chime + haptic when a priority notification arrives.
 * Web uses Web Audio; native uses expo-haptics (lazy-loaded).
 */
export async function playNotifyEngagement(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      const Haptics = await import('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    const AudioCtx =
      // @ts-expect-error web AudioContext
      typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const tones = [880, 1174];
    for (let i = 0; i < tones.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tones[i];
      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.05, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    }
    setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    /* engagement is best-effort */
  }
}
