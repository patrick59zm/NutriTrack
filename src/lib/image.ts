import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

export type PreparedImage = { base64: string; mediaType: 'image/jpeg' };

// Receipts are long and narrow with small print. Sent as one image, a long receipt is
// downscaled until the text is hard to read, so tall photos are cut into overlapping
// sections of a readable shape, top to bottom.
const TILE_WIDTH = 1100;
const MAX_TILE_ASPECT = 1.5; // height / width of one section
const OVERLAP = 0.08; // share of a section repeated in the next one
const MAX_TILES = 5;

export async function prepareReceiptImages(uri: string): Promise<PreparedImage[]> {
  // Decode once so width and height match the upright image (the picker's values can
  // ignore EXIF rotation), then cut sections from that decoded image.
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = source;
  const aspect = height / width;
  const tiles = aspect <= MAX_TILE_ASPECT ? 1 : Math.min(MAX_TILES, Math.ceil(aspect / MAX_TILE_ASPECT));

  if (tiles === 1) {
    const scale = Math.min(1, 1600 / Math.max(width, height));
    return [await render(source, null, scale < 1 ? { width: Math.round(width * scale) } : null)];
  }

  const step = height / tiles;
  const overlap = Math.round(step * OVERLAP);
  const out: PreparedImage[] = [];
  for (let i = 0; i < tiles; i++) {
    const originY = Math.max(0, Math.round(i * step) - overlap);
    const bottom = Math.min(height, Math.round((i + 1) * step) + overlap);
    out.push(
      await render(
        source,
        { originX: 0, originY, width, height: bottom - originY },
        width > TILE_WIDTH ? { width: TILE_WIDTH } : null,
      ),
    );
  }
  return out;
}

async function render(
  source: ImageRef,
  crop: { originX: number; originY: number; width: number; height: number } | null,
  resize: { width: number } | null,
): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(source);
  if (crop) context.crop(crop);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!result.base64) throw new Error('Could not read the image.');
  return { base64: result.base64, mediaType: 'image/jpeg' };
}
