import { contrastRatio, relativeLuminance } from '@/constants/contrast';

describe('contrast', () => {
  it('da 21:1 entre negro y blanco, sin importar el orden', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('da 1:1 entre un color y sí mismo', () => {
    expect(contrastRatio('#0f172a', '#0f172a')).toBe(1);
  });

  it('trata igual la forma corta y la larga', () => {
    expect(relativeLuminance('#fff')).toBe(relativeLuminance('#ffffff'));
    expect(contrastRatio('#fff', '#15803d')).toBe(contrastRatio('#ffffff', '#15803d'));
  });

  it('coincide con valores de referencia de WCAG', () => {
    // Gris #767676 sobre blanco: el gris más claro que cumple AA sobre blanco (4.54:1).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('rechaza colores que no son hexadecimales', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow('Color no soportado');
    expect(() => contrastRatio('#8888', '#ffffff')).toThrow('Color no soportado');
  });
});
