/**
 * Relación de contraste entre dos colores según WCAG 2.1, para verificar que un texto se lea sobre
 * su fondo. El mínimo AA para texto normal es 4.5:1.
 *
 * Acepta `#rgb` y `#rrggbb`, que son las dos formas en que aparecen los colores en los estilos.
 */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Luminancia relativa de un color, de 0 (negro) a 1 (blanco). */
export function relativeLuminance(color: string): number {
  const hex = expandHex(color);
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function expandHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join('')}`;
  throw new Error(`Color no soportado para calcular contraste: ${color}`);
}
