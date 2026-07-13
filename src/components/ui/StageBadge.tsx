import { View, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import type { ProjectStage } from '@/db/types/project';
import { PROJECT_STAGE_LABELS } from '@/db/types/project';
import { Badge } from './Badge';

type Props = {
  stage: ProjectStage;
};

const STAGE_VARIANT: Record<ProjectStage, 'warning' | 'accent' | 'success' | 'default'> = {
  INITIATION: 'warning',
  ACCEPTANCE: 'accent',
  PROGRESS: 'success',
  END: 'default',
};

export function StageBadge({ stage }: Props) {
  return <Badge label={PROJECT_STAGE_LABELS[stage].toUpperCase()} variant={STAGE_VARIANT[stage]} />;
}
