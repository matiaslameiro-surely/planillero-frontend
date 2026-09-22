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

export const HIGH_CONTRAST_COLORS = {
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
} as const;
