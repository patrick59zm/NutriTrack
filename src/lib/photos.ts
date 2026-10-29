import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

// Receipt photos are kept on the device so a scan can be checked against the original.
// The browser version cannot keep files between visits, so it keeps nothing.

const MAX_EDGE = 1600;

export async function saveReceiptPhoto(sourceUri: string, receiptId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'receipts');
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });

    // A downscaled JPEG is plenty for checking a line later and keeps storage small.
    const source = await ImageManipulator.manipulate(sourceUri).renderAsync();
    const context = ImageManipulator.manipulate(source);
    const longEdge = Math.max(source.width, source.height);
    if (longEdge > MAX_EDGE) {
      context.resize(source.height >= source.width ? { height: MAX_EDGE } : { width: MAX_EDGE });
    }
    const rendered = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

    const dest = new File(dir, `${receiptId}.jpg`);
    if (dest.exists) dest.delete();
    await new File(rendered.uri).move(dest);
    return dest.uri;
  } catch {
    return null; // the receipt is still useful without its photo
  }
}

export async function deleteReceiptPhoto(uri: string | undefined) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}
