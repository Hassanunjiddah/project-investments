import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { RoleGate } from '@/src/components/auth/RoleGate';
import ProjectsListScreen from '@/src/screens/projects/ProjectsListScreen';
import { Button } from '@/src/components/ui/Button';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';

class ProjectsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScreenLayout>
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>Couldn’t open Projects</Text>
            <Text style={{ fontSize: 14, opacity: 0.7 }}>
              {this.state.error.message || 'Something went wrong loading projects.'}
            </Text>
            <Button title="Retry" onPress={() => this.setState({ error: null })} />
          </View>
        </ScreenLayout>
      );
    }
    return this.props.children;
  }
}

export default function ProjectsRoute() {
  return (
    <ProjectsErrorBoundary>
      <RoleGate allow={['CEO', 'ADMIN', 'LINE_MANAGER', 'PROJECT_OWNER']}>
        <ProjectsListScreen />
      </RoleGate>
    </ProjectsErrorBoundary>
  );
}
