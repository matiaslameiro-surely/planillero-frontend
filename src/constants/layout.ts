import { useColorScheme } from 'react-native';

/**
 * Tokens ergonómicos y directrices de accesibilidad táctil para uso en campo.
 *
 * En tablets institucionales Android de 10'' operadas bajo luz solar, en movimiento
 * y frecuentemente con guantes de trabajo o una sola mano, todos los controles interactivos
 * (botones, inputs, selectores y chips) deben garantizar un área táctil mínima de 48x48 dp
 * conforme a las directrices de accesibilidad WCAG 2.1 (Target Size) y estándares ergonómicos.
 */

export const MIN_TOUCH_TARGET = 48;

export const ERGONOMIC_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export interface ThemeColors {
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly textInverse: string;
  readonly borderDefault: string;
  readonly borderStrong: string;
  readonly borderFocus: string;
  readonly bgSurface: string;
  readonly bgBackdrop: string;
  readonly primary: string;
  readonly primaryActive: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
}

export const LIGHT_THEME: ThemeColors = {
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textInverse: '#ffffff',
  borderDefault: '#cbd5e1',
  borderStrong: '#94a3b8',
  borderFocus: '#2563eb',
  bgSurface: '#ffffff',
  bgBackdrop: '#f8fafc',
  primary: '#1d4ed8',
  primaryActive: '#1e40af',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
};

export const DARK_THEME: ThemeColors = {
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textInverse: '#0f172a',
  borderDefault: '#334155',
  borderStrong: '#475569',
  borderFocus: '#3b82f6',
  bgSurface: '#1e293b',
  bgBackdrop: '#0f172a',
  primary: '#3b82f6',
  primaryActive: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export const HIGH_CONTRAST_COLORS = LIGHT_THEME;

/**
 * Hook para obtener la paleta de colores según el tema activo del sistema (claro u oscuro).
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
