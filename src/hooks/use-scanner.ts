import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { analyzeReceipt, describeError, isCancelled, type ScanPhase } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { prepareReceiptImages } from '@/lib/image';
import { deleteReceiptPhoto, saveReceiptPhoto } from '@/lib/photos';
import { loadSettings, saveReceipt, updateReceipt } from '@/lib/storage';
import type { Receipt } from '@/lib/types';

/**
 * The whole scan flow: pick a photo, prepare it, have Claude read it, keep the photo,
 * save the receipt. With `replaceId`, the result replaces an existing receipt (re-scan).
 */
export function useScanner({ replaceId, onDone }: { replaceId?: string; onDone: (receipt: Receipt) => void }) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>('reading');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const analyzePhoto = useCallback(
    async (uri: string) => {
      setError(null);
      setPreview(uri);
      setPhase('reading');
      setBusy(true);
      const abort = new AbortController();
      controller.current = abort;
      try {
        const [images, settings] = await Promise.all([prepareReceiptImages(uri), loadSettings()]);
        if (abort.signal.aborted) return;
        const fresh = await analyzeReceipt(images, settings, { signal: abort.signal, onPhase: setPhase });
        const id = replaceId ?? fresh.id;
        const photoUri = (await saveReceiptPhoto(uri, id)) ?? undefined;
        let saved: Receipt | null;
        if (replaceId) {
          saved = await updateReceipt(replaceId, (old) => {
            if (old.photoUri && old.photoUri !== photoUri) deleteReceiptPhoto(old.photoUri);
            return { ...fresh, id: old.id, scannedAt: old.scannedAt, photoUri: photoUri ?? old.photoUri };
          });
          if (!saved) throw new Error('This receipt no longer exists.');
        } else {
          saved = { ...fresh, ...(photoUri && { photoUri }) };
          await saveReceipt(saved);
        }
        success();
        onDone(saved);
      } catch (e) {
        if (!isCancelled(e)) {
          failure();
          setError(describeError(e));
        }
      } finally {
        controller.current = null;
        setBusy(false);
        setPreview(null);
        if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      }
    },
    [replaceId, onDone],
  );

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      setError(null);
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph receipts.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) await analyzePhoto(result.assets[0].uri);
    },
    [analyzePhoto],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const clearError = useCallback(() => setError(null), []);

  return { busy, phase, preview, error, analyzePhoto, pick, cancel, clearError, isWeb: Platform.OS === 'web' };
}
