import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Phone browsers and in-app web views only open the photo picker for a tap that lands
 * on a real file input; a click triggered from script (what expo-image-picker does on
 * web) is often ignored. So an invisible input covers the button and takes the tap.
 * `accept="image/*"` lets phones offer the camera as well as the photo library.
 */
export function ImageFileInput({ onPick, children }: { onPick: (uri: string) => void; children: ReactNode }) {
  return (
    <View style={{ position: 'relative' }}>
      {children}
      <input
        type="file"
        accept="image/*"
        aria-label="Upload a receipt photo"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = ''; // picking the same photo again still fires change
          if (file) onPick(URL.createObjectURL(file));
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
