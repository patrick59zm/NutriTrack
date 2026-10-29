import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#161A17',
    textSecondary: '#5F665F',
    textTertiary: '#969C95',
    background: '#F5F3EE',
    surface: '#FFFFFF',
    surfaceMuted: '#EEEBE3',
    border: '#E4DFD4',
    brand: '#1B7A4B',
    brandStrong: '#115C37',
    brandSoft: '#E1F2E7',
    onBrand: '#FFFFFF',
    warn: '#C9780A',
    warnSoft: '#FCEFD8',
    danger: '#CF3F37',
    dangerSoft: '#FBE7E5',
    shadow: 'rgba(40, 36, 24, 0.08)',
  },
  dark: {
    text: '#F1F4F0',
    textSecondary: '#A7AEA7',
    textTertiary: '#6F766F',
    background: '#0E110F',
    surface: '#171B18',
    surfaceMuted: '#20251F',
    border: '#2A302A',
    brand: '#3FC381',
    brandStrong: '#7BE0AA',
    brandSoft: '#15301F',
    onBrand: '#06140C',
    warn: '#F2A93B',
    warnSoft: '#3A2B12',
    danger: '#FF6F63',
    dangerSoft: '#3B1C19',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in ThemeColor]: string };

/** Macro colors are shared between themes; each keeps contrast on both backgrounds. */
export const MacroColors = {
  protein: '#EF5A5F',
  carbs: '#F2B33D',
  fat: '#4A8CF0',
} as const;

export const HeroGradient = {
  light: ['#1F8A55', '#0F5E3A'],
  dark: ['#1C6B45', '#0B3B25'],
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
  twelve: 48,
} as const;

export const Radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const MaxContentWidth = 640;
