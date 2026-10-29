import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

const clampNumber = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

/**
 * Shows the receipt photo full screen. Pinch to zoom, drag to move around, double-tap
 * to zoom in on a spot or back out; the same gestures on Android, iOS and the web.
 */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {uri && <Zoomable uri={uri} onClose={onClose} />}
    </Modal>
  );
}

function Zoomable({ uri, onClose }: { uri: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const t = useT();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // Keep the picture over the screen: at scale s the image may move at most (s - 1) / 2 of its size.
  const settle = (nextScale: number, nextX: number, nextY: number) => {
    'worklet';
    const s = clampNumber(nextScale, 1, MAX_SCALE);
    const boundX = ((s - 1) * width) / 2;
    const boundY = ((s - 1) * height) / 2;
    scale.value = withTiming(s);
    x.value = withTiming(clampNumber(nextX, -boundX, boundX));
    y.value = withTiming(clampNumber(nextY, -boundY, boundY));
    savedScale.value = s;
    savedX.value = clampNumber(nextX, -boundX, boundX);
    savedY.value = clampNumber(nextY, -boundY, boundY);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampNumber(savedScale.value * e.scale, 1, MAX_SCALE);
    })
    .onEnd(() => {
      settle(scale.value, x.value, y.value);
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      settle(scale.value, x.value, y.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        settle(1, 0, 0);
      } else {
        // Zoom towards the tapped spot.
        const dx = (width / 2 - e.x) * (DOUBLE_TAP_SCALE - 1);
        const dy = (height / 2 - e.y) * (DOUBLE_TAP_SCALE - 1);
        settle(DOUBLE_TAP_SCALE, dx, dy);
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.backdrop}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, style]} accessibilityLabel={t('photo.a11y')}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      </GestureDetector>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('photo.close')}
        style={[styles.close, { top: insets.top + Spacing.three }]}>
        <Ionicons name="close" size={22} color="#FFFFFF" />
        <ThemedText variant="captionStrong" style={styles.closeText}>
          {t('common.close')}
        </ThemedText>
      </Pressable>
      <ThemedText variant="caption" style={[styles.hint, { bottom: insets.bottom + Spacing.four }]}>
        {t('photo.hint')}
      </ThemedText>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },
  close: {
    position: 'absolute',
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  closeText: { color: '#FFFFFF' },
  hint: { position: 'absolute', alignSelf: 'center', color: 'rgba(255,255,255,0.6)' },
});
