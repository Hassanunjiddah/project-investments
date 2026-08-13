import { RoleGate } from '@/src/components/auth/RoleGate';
import ProjectsListScreen from '@/src/screens/projects/ProjectsListScreen';

export default function ProjectsRoute() {
  return (
    <RoleGate allow={['CEO', 'ADMIN', 'LINE_MANAGER', 'PROJECT_OWNER']}>
      <ProjectsListScreen />
    </RoleGate>
  );
}
