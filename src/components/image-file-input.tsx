import type { ReactNode } from 'react';

/**
 * Native apps pick photos with expo-image-picker, so this only renders its children.
 * The web version (image-file-input.web.tsx) lays a real file input over them.
 */
export function ImageFileInput({
  children,
}: {
  onPick?: (uri: string) => void;
  onPickMany?: (uris: string[]) => void;
  multiple?: boolean;
  children: ReactNode;
}) {
  return <>{children}</>;
}
