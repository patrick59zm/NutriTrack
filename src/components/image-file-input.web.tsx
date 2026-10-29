import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Phone browsers and in-app web views only open the photo picker for a tap that lands
 * on a real file input; a click triggered from script (what expo-image-picker does on
 * web) is often ignored. So an invisible input covers the button and takes the tap.
 * `accept="image/*"` lets phones offer the camera as well as the photo library.
 */
export function ImageFileInput({
  onPick,
  onPickMany,
  multiple,
  children,
}: {
  onPick?: (uri: string) => void;
  /** With `multiple`, every chosen file at once. */
  onPickMany?: (uris: string[]) => void;
  multiple?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ position: 'relative' }}>
      {children}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        aria-label="Upload a receipt photo"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = ''; // picking the same photo again still fires change
          if (files.length === 0) return;
          const uris = files.map((file) => URL.createObjectURL(file));
          if (multiple && onPickMany) onPickMany(uris);
          else onPick?.(uris[0]);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          fontSize: 0,
        }}
      />
    </View>
  );
}
