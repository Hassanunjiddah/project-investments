import { memo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useProjectAudit } from '@/src/hooks/transparency/useTransparency';
import type { AuditEvent } from '@/src/services/transparency.services';
import { formatDateTime } from '@/src/utils/date';

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  stage_changed: 'Stage changed',
  approval_status_changed: 'Approval status',
  accepted: 'Investor accepted',
  pledged: 'Units pledged',
  payment_claimed: 'Payment claimed',
  verified_and_allotted: 'Payment verified',
  declined: 'Invite declined',
  declared: 'Profit declared',
  approved: 'Declaration approved',
  rejected: 'Declaration rejected',
  uploaded: 'Document uploaded',
  deleted: 'Document deleted',
  requested: 'Requested',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  posted: 'Activity posted',
  updated: 'Project updated',
  owner_assigned: 'Owner assigned',
  paid: 'Drawdown paid',
  decided: 'Decision recorded',
};

const EVENT_COLOR: Record<string, string> = {
  created: '#0369A1',
  approved: '#0F5B2D',
  approval_status_changed: '#0F5B2D',
  rejected: '#8A1D1D',
  declined: '#8A1D1D',
  declared: '#7A5300',
  payment_claimed: '#7A5300',
  pledged: '#6D28D9',
  verified_and_allotted: '#0F5B2D',
  accepted: '#0369A1',
  stage_changed: '#475569',
  uploaded: '#0369A1',
  deleted: '#8A1D1D',
  requested: '#7A5300',
  fulfilled: '#0F5B2D',
  cancelled: '#475569',
  posted: '#0369A1',
  updated: '#475569',
  owner_assigned: '#6D28D9',
  paid: '#0F5B2D',
  decided: '#475569',
};

function humaniseContext(ctx: Record<string, unknown>): string {
  const parts: string[] = [];
  if (ctx.reference) parts.push(String(ctx.reference));
  if (ctx.from && ctx.to) parts.push(`${ctx.from} → ${ctx.to}`);
  if (ctx.gross != null) parts.push(`gross ₦${(Number(ctx.gross) / 100).toLocaleString()}`);
  if (ctx.investor_pool != null) parts.push(`pool ₦${(Number(ctx.investor_pool) / 100).toLocaleString()}`);
  if (ctx.per_unit != null) parts.push(`₦${(Number(ctx.per_unit) / 100).toLocaleString()}/unit`);
  if (ctx.units != null) parts.push(`${ctx.units} units`);
  if (ctx.amount_minor != null) parts.push(`₦${(Number(ctx.amount_minor) / 100).toLocaleString()}`);
  if (ctx.payment_reference) parts.push(`ref ${ctx.payment_reference}`);
  if (ctx.note) parts.push(`note: ${ctx.note}`);
  if (ctx.email) parts.push(String(ctx.email));
  if (ctx.name) parts.push(String(ctx.name));
  if (ctx.code) parts.push(String(ctx.code));
  if (ctx.title) parts.push(String(ctx.title));
  if (ctx.kind) parts.push(String(ctx.kind));
  if (ctx.doc_kind) parts.push(String(ctx.doc_kind));
  if (ctx.file_name) parts.push(String(ctx.file_name));
  return parts.join(' · ');
}

export const ProjectAuditTab = memo(function ProjectAuditTab({ projectId }: { projectId: string }) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: events = [], isLoading } = useProjectAudit(projectId);

  const exportCsv = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const header = 'timestamp,event,entity,actor,context';
    const rows = events.map((e) => {
      const ctx = JSON.stringify(e.context ?? {}).replace(/"/g, '""');
      return `${e.createdAt},${e.eventType},${e.entityType},${e.actorId ?? ''},"${ctx}"`;
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events, projectId]);

  return (
    <ScrollView contentContainerStyle={styles.container} data-testid="project-audit-tab">
      <View style={styles.header}>
        <Text style={[styles.h2, { color: palette.text }]}>Audit trail</Text>
        <Pressable
          onPress={exportCsv}
          style={[styles.exportBtn, { borderColor: palette.border, backgroundColor: palette.surface }]}
          data-testid="export-audit-csv-btn"
          accessibilityRole="button"
          accessibilityLabel="Export audit trail as CSV file"
        >
          <Text style={{ color: palette.text, fontSize: typography.sizes.xs, fontWeight: '600' }}>
            Export CSV
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Every action recorded, in order. Immutable and exportable — this is what separates institutional-grade platforms from spreadsheets.
      </Text>

      {isLoading ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Loading…</Text>
      ) : events.length === 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <EmptyState title="No events yet" message="Actions on this project will appear here." />
        </View>
      ) : (
        events.map((e: AuditEvent) => {
          const color = EVENT_COLOR[e.eventType] ?? palette.textSecondary;
          const baseLabel = EVENT_LABEL[e.eventType] ?? e.eventType.replace(/_/g, ' ');
          const label =
            e.entityType && e.entityType !== 'project'
              ? `${baseLabel} · ${e.entityType.replace(/_/g, ' ')}`
              : baseLabel;
          const humanised = humaniseContext(e.context ?? {});
          return (
            <View
              key={e.id}
              style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={styles.rowHead}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.event, { color: palette.text }]}>{label}</Text>
                <Text style={[styles.time, { color: palette.textSecondary }]}>
                  {formatDateTime(e.createdAt)}
                </Text>
              </View>
              {humanised ? (
                <Text style={[styles.body, { color: palette.textSecondary }]}>{humanised}</Text>
              ) : null}
              <Text style={[styles.entity, { color: palette.muted }]}>
                {e.entityType}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: typography.sizes.lg, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, marginTop: 4, marginBottom: spacing.sm },
  exportBtn: { paddingHorizontal: spacing.sm + 4, paddingVertical: 10, minHeight: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 999 },
  event: { flex: 1, fontSize: typography.sizes.sm, fontWeight: '700' },
  time: { fontSize: typography.sizes.xs },
  body: { fontSize: typography.sizes.sm, marginLeft: spacing.md + 8 },
  entity: {
    fontSize: typography.sizes.xs,
    marginLeft: spacing.md + 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
