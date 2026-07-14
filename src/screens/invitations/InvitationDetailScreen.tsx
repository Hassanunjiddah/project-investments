import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGetInvitationDetail } from '@/src/hooks/invitations/useGetInvitationDetail';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

/** Thin redirect: invitation routes now open gated project detail. */
export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const { data, isLoading, isError, error, refetch } = useGetInvitationDetail(id ?? '');

  useEffect(() => {
    if (!data?.invite) return;
    router.replace({
      pathname: '/(tabs)/projects/[id]',
      params: { id: data.invite.projectId, invite: data.invite.id },
    });
  }, [data, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load invitation"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) return <EmptyState title="Invitation not found" />;

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={palette.primary} />
    </View>
  );
}
