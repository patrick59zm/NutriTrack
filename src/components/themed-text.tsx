import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'captionStrong'
  | 'overline'
  | 'number';

export type ThemedTextProps = TextProps & {
  variant?: TextVariant;
  color?: ThemeColor;
};

export function ThemedText({ style, variant = 'body', color, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[color ?? 'text'] }, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  number: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
});
