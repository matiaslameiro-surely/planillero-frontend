import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { act, create } from 'react-test-renderer';

import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { DARK_THEME, LIGHT_THEME } from '@/constants/layout';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

/** Junta todo el texto visible de la barra, para poder afirmar sobre lo que ve el operador. */
function textOf(props: Parameters<typeof DeviceStatusBar>[0]): string {
  let renderer!: ReturnType<typeof create>;
  // `create` de react-test-renderer 19 necesita `act` para que el render termine antes de leer.
  act(() => {
    renderer = create(<DeviceStatusBar {...props} />);
  });
  return JSON.stringify(renderer.toJSON());
}

const base = { online: true, batteryLevel: 0.82, gps: 'ready' as const, pendingVisits: 3 };

describe('DeviceStatusBar', () => {
  it('muestra el modo conectado', () => {
    const text = textOf(base);

    expect(text).toContain('Modo conectado');
    expect(text).not.toContain('Modo offline');
  });

  it('muestra el modo offline cuando no hay conexión', () => {
    const text = textOf({ ...base, online: false });

    expect(text).toContain('Modo offline');
    expect(text).not.toContain('Modo conectado');
  });

  it('muestra la batería en porcentaje entero', () => {
    expect(textOf({ ...base, batteryLevel: 0.826 })).toContain('Batería 83%');
  });

  it('avisa cuando no se conoce la batería', () => {
    expect(textOf({ ...base, batteryLevel: null })).toContain('Batería sin datos');
  });

  it.each([
    ['ready', 'GPS listo'],
    ['disabled', 'GPS apagado'],
    ['denied', 'GPS sin permiso'],
    ['unknown', 'GPS sin datos'],
  ] as const)('dice el estado del GPS %s', (gps, label) => {
    expect(textOf({ ...base, gps })).toContain(label);
  });

  it('cuenta las visitas pendientes en singular y plural', () => {
    expect(textOf({ ...base, pendingVisits: 1 })).toContain('1 visita pendiente');
    expect(textOf({ ...base, pendingVisits: 0 })).toContain('0 visitas pendientes');
    expect(textOf({ ...base, pendingVisits: 5 })).toContain('5 visitas pendientes');
  });
});

/** Luminancia relativa de un color `#rrggbb`, según WCAG 2.1. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores `#rrggbb`. */
function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Normaliza `#fff` a `#ffffff` para poder calcular el contraste. */
function expandHex(hex: string): string {
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

function renderBar(props: Parameters<typeof DeviceStatusBar>[0]) {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<DeviceStatusBar {...props} />);
  });
  const bar = renderer.root.findByProps({ accessibilityLabel: 'Estado del dispositivo' });
  const textStyle = (label: string) => {
    const text = renderer.root.findAllByType(Text).find((t) => t.props.children === label);
    if (!text) throw new Error(`No se encontró el texto «${label}»`);
    return StyleSheet.flatten(text.props.style);
  };
  const chipBackground = (label: string) => {
    const text = renderer.root.findAllByType(Text).find((t) => t.props.children === label)!;
    const chip = text.parent!.parent as unknown as { type: unknown; props: { style: unknown } };
    expect(chip.type).toBe(View);
    return StyleSheet.flatten(chip.props.style as never) as { backgroundColor: string };
  };
  return { barStyle: StyleSheet.flatten(bar.props.style), textStyle, chipBackground };
}

describe.each([
  ['claro', 'light', LIGHT_THEME],
  ['oscuro', 'dark', DARK_THEME],
] as const)('DeviceStatusBar en tema %s', (_name, scheme, theme) => {
  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
  });

  it('declara su propio fondo y borde, tomados del tema', () => {
    const { barStyle } = renderBar(base);

    expect(barStyle.backgroundColor).toBe(theme.bgBackdrop);
    expect(barStyle.borderBottomColor).toBe(theme.borderDefault);
  });

  it.each(['Batería 82%', 'GPS listo', '3 visitas pendientes'])(
    '«%s» usa el color del tema con contraste de al menos 4.5:1 contra el fondo',
    (label) => {
      const { barStyle, textStyle } = renderBar(base);
      const color = textStyle(label).color as string;

      expect(color).toBe(theme.textSecondary);
      expect(contrastRatio(color, barStyle.backgroundColor as string)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ['disabled', 'GPS apagado'],
    ['denied', 'GPS sin permiso'],
    ['unknown', 'GPS sin datos'],
  ] as const)(
    'el aviso del GPS %s se destaca en negrita y color de peligro, con contraste de al menos 4.5:1',
    (gps, label) => {
      const { barStyle, textStyle } = renderBar({ ...base, gps });
      const style = textStyle(label);

      expect(style.color).toBe(theme.danger);
      expect(style.fontWeight).toBe('700');
      expect(contrastRatio(style.color as string, barStyle.backgroundColor as string)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    [true, 'Modo conectado'],
    [false, 'Modo offline'],
  ])('el chip con online=%s tiene contraste de al menos 4.5:1 entre texto y fondo', (online, label) => {
    const { textStyle, chipBackground } = renderBar({ ...base, online });
    const textColor = expandHex(textStyle(label).color as string);

    expect(contrastRatio(textColor, chipBackground(label).backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
});
