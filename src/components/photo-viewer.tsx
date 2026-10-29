import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/** Shows the receipt photo full screen; tall receipts scroll, and iOS can pinch to zoom. */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = useT();
  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={styles.scroll}>
          {uri && <Image source={{ uri }} style={{ width, aspectRatio: 0.45 }} contentFit="contain" contentPosition="top" />}
        </ScrollView>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  scroll: { paddingTop: 72, paddingBottom: 40 },
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
});
