import { Component, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type State = { error: Error | null };

/**
 * Last-resort visible fallback so a render crash never leaves a silent white page.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.shell} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.msg}>
          {this.state.error.message || 'The app failed to load this screen.'}
        </Text>
        <Pressable
          onPress={() => {
            this.setState({ error: null });
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
          style={styles.btn}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#F4F6F8',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0B1220',
  },
  msg: {
    fontSize: 14,
    color: '#4E5A52',
    textAlign: 'center',
    maxWidth: 420,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#064F92',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
