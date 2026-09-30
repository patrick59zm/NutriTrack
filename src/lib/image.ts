import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

// Long edge in px. Receipts are tall and the print is small, so keep it fairly high
// while staying well under the API's 5 MB per-image limit.
const MAX_EDGE = 2400;

export type PreparedImage = { base64: string; mediaType: 'image/jpeg' };

export async function prepareReceiptImage(asset: ImagePickerAsset): Promise<PreparedImage> {
  const longEdge = Math.max(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longEdge > MAX_EDGE) {
    context.resize(asset.height >= asset.width ? { height: MAX_EDGE } : { width: MAX_EDGE });
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('Could not read the image.');
  return { base64: result.base64, mediaType: 'image/jpeg' };
}
