import { Platform } from 'react-native';

import type { PreparedImage } from './image';

/**
 * The demo build can run inside a claude.ai artifact page, whose host offers the page a
 * `sample` capability: a Claude call billed to the viewer's own account, after they allow
 * it. Outside such a page (Expo Go, a normal browser tab) this resolves null.
 */
export type ViewerClaude = {
  json(input: string, options?: { images?: Blob[]; cache?: boolean; modelTier?: string }): Promise<unknown>;
  limits(): Promise<{ images?: { maxCount: number } }>;
};

type SampleError = { code?: string; message?: string };

/** Codes after which the viewer's Claude cannot be used in this view; fall back quietly. */
const UNAVAILABLE = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
  'images_unavailable',
  'session_expired',
]);

export async function viewerClaude(): Promise<ViewerClaude | null> {
  if (Platform.OS !== 'web') return null;
  const host = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (typeof host?.use !== 'function') return null;
  try {
    return ((await host.use('sample')) as ViewerClaude | null) ?? null;
  } catch {
    return null;
  }
}

export function isUnavailable(e: unknown) {
  return UNAVAILABLE.has((e as SampleError)?.code ?? '');
}

export function viewerErrorMessage(e: unknown) {
  switch ((e as SampleError)?.code) {
    case 'rate_limited':
      return 'Claude is busy or your usage limit is reached. Try again in a moment.';
    case 'image_rejected':
      return 'That image could not be used. Try a JPEG or PNG photo.';
    case 'refused':
      return 'Claude declined this request. Try another photo.';
    case 'invalid_json':
    case 'empty_completion':
      return 'Claude’s answer could not be read. Please try again.';
    default:
      return 'Could not reach Claude. Please try again.';
  }
}

export function toBlob(image: PreparedImage) {
  const binary = atob(image.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: image.mediaType });
}
