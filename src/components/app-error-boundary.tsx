import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';

type State = { error: Error | null };

/**
 * Catches rendering errors anywhere below it, so one broken screen never takes the
 * whole app down. The person sees what happened and can get back to the start.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled error in a screen', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Card style={styles.card}>
          <ThemedText style={styles.emoji}>🫠</ThemedText>
          <ThemedText variant="headline" style={styles.center}>
            Something went wrong
          </ThemedText>
          <ThemedText variant="body" color="textSecondary" style={styles.center}>
            Your receipts are safe. Tap below to go back to the start.
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary" style={styles.center}>
            {this.state.error.message}
          </ThemedText>
          <Button title="Back to start" icon="refresh" onPress={() => this.setState({ error: null })} />
        </Card>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  card: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.eight },
  center: { textAlign: 'center' },
  emoji: { fontSize: 48, lineHeight: 58 },
});
