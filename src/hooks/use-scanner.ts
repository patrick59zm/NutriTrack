import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { analyzeReceipt, describeError, isCancelled, type ScanPhase } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { prepareReceiptImages } from '@/lib/image';
import { deleteReceiptPhoto, saveReceiptPhoto } from '@/lib/photos';
import { syncReminders } from '@/lib/reminders';
import { loadSettings, saveReceipt, updateReceipt } from '@/lib/storage';
import type { Receipt } from '@/lib/types';

/** A long receipt can be photographed in parts; more than this would make one very slow request. */
export const MAX_PHOTOS = 4;

/**
 * The whole scan flow: pick a photo, prepare it, have Claude read it, keep the photo,
 * save the receipt. With `replaceId`, the result replaces an existing receipt (re-scan).
 * Several photos of one receipt are read as consecutive sections, top to bottom.
 */
export function useScanner({ replaceId, onDone }: { replaceId?: string; onDone: (receipt: Receipt) => void }) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>('reading');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const analyzePhotos = useCallback(
    async (uris: string[]) => {
      const photos = uris.slice(0, MAX_PHOTOS);
      if (photos.length === 0) return;
      setError(null);
      setPreview(photos[0]);
      setPhase('reading');
      setBusy(true);
      const abort = new AbortController();
      controller.current = abort;
      try {
        const [imageSets, settings] = await Promise.all([Promise.all(photos.map(prepareReceiptImages)), loadSettings()]);
        if (abort.signal.aborted) return;
        const fresh = await analyzeReceipt(imageSets.flat(), settings, { signal: abort.signal, onPhase: setPhase });
        const id = replaceId ?? fresh.id;
        const photoUri = (await saveReceiptPhoto(photos[0], id)) ?? undefined;
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
        syncReminders();
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
        for (const uri of photos) if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      }
    },
    [replaceId, onDone],
  );

  const analyzePhoto = useCallback((uri: string) => analyzePhotos([uri]), [analyzePhotos]);

  /** Opens the camera or the photo library and resolves to the chosen photo, or null. */
  const pickUri = useCallback(async (source: 'camera' | 'library') => {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('scan.cameraTitle'), t('scan.cameraMessage'));
        return null;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    return !result.canceled && result.assets[0] ? result.assets[0].uri : null;
  }, []);

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      const uri = await pickUri(source);
      if (uri) await analyzePhoto(uri);
    },
    [pickUri, analyzePhoto],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    busy,
    phase,
    preview,
    error,
    analyzePhoto,
    analyzePhotos,
    pick,
    pickUri,
    cancel,
    clearError,
    isWeb: Platform.OS === 'web',
  };
}
