import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ImageFileInput } from '@/components/image-file-input';
import { ThemedText } from '@/components/themed-text';
import { Button, Sheet } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_PHOTOS } from '@/hooks/use-scanner';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

/**
 * Collects several photos of one long receipt (top to bottom) and hands them over
 * for one scan. On the phone the camera or gallery adds one photo at a time; in the
 * browser the file input takes several at once.
 */
export function MultiPhotoSheet({
  isWeb,
  onPickUri,
  onScan,
  onClose,
}: {
  isWeb: boolean;
  onPickUri: (source: 'camera' | 'library') => Promise<string | null>;
  onScan: (uris: string[]) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const [uris, setUris] = useState<string[]>([]);
  const full = uris.length >= MAX_PHOTOS;

  const add = (more: string[]) => setUris((list) => [...list, ...more].slice(0, MAX_PHOTOS));
  const addFrom = async (source: 'camera' | 'library') => {
    const uri = await onPickUri(source);
    if (uri) add([uri]);
  };
  const remove = (index: number) => {
    tap();
    setUris((list) => list.filter((_, i) => i !== index));
  };

  return (
    <Sheet visible title={t('multi.title')} onClose={onClose}>
      <ThemedText variant="body" color="textSecondary">
        {t('multi.hint', { n: MAX_PHOTOS })}
      </ThemedText>
      {uris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {uris.map((uri, i) => (
            <View key={uri} style={[styles.thumb, { borderColor: theme.border }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
              <View style={[styles.number, { backgroundColor: theme.brand }]}>
                <ThemedText variant="captionStrong" style={{ color: theme.onBrand }}>
                  {i + 1}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => remove(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('multi.removePhoto', { n: i + 1 })}
                style={styles.remove}>
                <Ionicons name="close-circle" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      {isWeb ? (
        <ImageFileInput multiple onPickMany={add}>
          <Button title={t('multi.addPhoto')} icon="cloud-upload-outline" variant="secondary" disabled={full} onPress={() => {}} />
        </ImageFileInput>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title={t('common.takePhoto')} icon="camera" variant="secondary" disabled={full} onPress={() => addFrom('camera')} />
          </View>
          <View style={styles.flex}>
            <Button title={t('common.gallery')} icon="images-outline" variant="secondary" disabled={full} onPress={() => addFrom('library')} />
          </View>
        </View>
      )}
      <Button
        title={t('multi.scan', { n: uris.length })}
        icon="scan"
        disabled={uris.length === 0}
        onPress={() => {
          onScan(uris);
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  strip: { gap: Spacing.three, paddingVertical: Spacing.one },
  thumb: { width: 84, height: 112, borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  number: {
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  remove: { position: 'absolute', right: 4, top: 4 },
});
