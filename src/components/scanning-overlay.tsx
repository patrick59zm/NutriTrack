import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

const STEPS = [
  'Reading the receipt…',
  'Recognizing products…',
  'Estimating pack sizes…',
  'Calculating nutrition…',
  'Checking shelf life…',
];

const FRAME_HEIGHT = 340;

export function ScanningOverlay({ visible, imageUri }: { visible: boolean; imageUri: string | null }) {
  const [step, setStep] = useState(0);
  const line = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    line.value = 0;
    line.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    return () => {
      clearInterval(timer);
      setStep(0);
    };
  }, [visible, line]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (FRAME_HEIGHT - 4) }] }));

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.content}>
          <View style={styles.frame}>
            {imageUri && <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            <View style={styles.dim} />
            <Animated.View style={[styles.line, lineStyle]}>
              <LinearGradient
                colors={['rgba(80,230,150,0)', 'rgba(80,230,150,0.45)', 'rgba(80,230,150,0)']}
                style={styles.glow}
              />
              <View style={styles.lineCore} />
            </Animated.View>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
          </View>
          <View style={styles.status}>
            <ActivityIndicator color="#7BE0AA" />
            <Animated.View key={step} entering={FadeIn.duration(300)}>
              <ThemedText variant="headline" style={styles.white}>
                {STEPS[step]}
              </ThemedText>
            </Animated.View>
          </View>
          <ThemedText variant="caption" style={styles.muted}>
            Claude is reading every line. This usually takes 20–60 seconds.
          </ThemedText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const CORNER = 26;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 9, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
  },
  content: { width: '100%', maxWidth: 360, alignItems: 'center', gap: Spacing.five },
  frame: {
    width: '100%',
    height: FRAME_HEIGHT,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1A211C',
  },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  line: { position: 'absolute', left: 0, right: 0, top: -30, height: 64, justifyContent: 'center' },
  glow: { ...StyleSheet.absoluteFill },
  lineCore: { height: 2, backgroundColor: '#7BE0AA', marginHorizontal: Spacing.two, borderRadius: 1 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#7BE0AA' },
  tl: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  white: { color: '#FFFFFF' },
  muted: { color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
