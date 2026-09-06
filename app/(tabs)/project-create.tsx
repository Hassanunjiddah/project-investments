import CreateProjectWizard from '@/src/screens/projects/CreateProjectWizard';
import { FocusedFill } from '@/src/components/nav/TabSlotLayout';

export default function ProjectCreateRoute() {
  return (
    <FocusedFill>
      <CreateProjectWizard />
    </FocusedFill>
  );
}
