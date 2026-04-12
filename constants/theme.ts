import { Platform } from 'react-native';

// Telegram-inspired color palette
export const TG = {
  // Backgrounds
  bg: '#ffffff',
  bgSecondary: '#f0f2f5',
  bgChat: '#e6ebee',
  headerBg: '#517da2',
  // Text
  textPrimary: '#000000',
  textSecondary: '#707579',
  textHint: '#a8a8a8',
  textWhite: '#ffffff',
  // Accents
  accent: '#3390ec',
  accentDark: '#2b7cd3',
  accentLight: 'rgba(51, 144, 236, 0.08)',
  green: '#4fae4e',
  greenLight: 'rgba(79, 174, 78, 0.1)',
  red: '#e53935',
  redLight: 'rgba(229, 57, 53, 0.1)',
  orange: '#e58c39',
  orangeLight: 'rgba(229, 140, 57, 0.1)',
  purple: '#8b5cf6',
  purpleLight: 'rgba(139, 92, 246, 0.1)',
  // Bubbles
  bubbleOutgoing: '#eeffde',
  bubbleIncoming: '#ffffff',
  // Borders / Dividers
  separator: '#e0e0e0',
  separatorLight: '#f0f0f0',
  // Tab bar
  tabBg: '#ffffff',
  tabActive: '#3390ec',
  tabInactive: '#a8a8a8',
};

export const Colors = {
  light: {
    text: TG.textPrimary,
    background: TG.bg,
    tint: TG.accent,
    icon: TG.textSecondary,
    tabIconDefault: TG.tabInactive,
    tabIconSelected: TG.tabActive,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
