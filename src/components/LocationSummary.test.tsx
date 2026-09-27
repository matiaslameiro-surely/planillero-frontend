import { StyleSheet, Text, useColorScheme } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ACCURACY_STYLE, LocationSummary } from '@/components/LocationSummary';
import { contrastRatio } from '@/constants/contrast';
import { DARK_THEME, LIGHT_THEME } from '@/constants/layout';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

function render(accuracyMeters: number) {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <LocationSummary
        latitude={-34.603712}
        longitude={-58.381593}
        accuracyMeters={accuracyMeters}
        startedAt="2026-11-01T15:00:00Z"
      />,
    );
  });
  return { json: JSON.stringify(renderer.toJSON()), root: renderer.root };
}

describe('LocationSummary', () => {
  it('muestra latitud y longitud con 6 decimales', () => {
    const { json } = render(8);

    expect(json).toContain('-34.603712');
    expect(json).toContain('-58.381593');
  });

  it('muestra la precisión en metros redondeada', () => {
    expect(render(8.6).json).toContain('9 m');
  });

  it.each([
    [10, 'green'],
    [30, 'yellow'],
    [80, 'red'],
  ] as const)('con %s m usa el semáforo %s, con su texto', (meters, level) => {
    const { json } = render(meters);

    expect(json).toContain(ACCURACY_STYLE[level].label);
    expect(json).toContain(ACCURACY_STYLE[level].color);
  });

  it('no tiene campos de entrada: el bloque no es editable', () => {
    const { root } = render(8);

    expect(root.findAll((node) => String(node.type) === 'TextInput')).toHaveLength(0);
  });
});

describe.each([
  ['claro', 'light', LIGHT_THEME],
  ['oscuro', 'dark', DARK_THEME],
] as const)('LocationSummary en tema %s (PLAN-67)', (_name, scheme, theme) => {
  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
  });

  it('declara el borde tomado del tema', () => {
    const { root } = render(8);
    const box = root.findByProps({ accessibilityLabel: 'Ubicación registrada al iniciar la visita' });
    const boxStyle = StyleSheet.flatten(box.props.style);

    expect(boxStyle.borderColor).toBe(theme.borderDefault);
  });

  it('los textos toman su color de useThemeColors y tienen contraste >= 4.5:1 contra el fondo de la tarjeta', () => {
    const { root } = render(8);
    const texts = root.findAllByType(Text);
    expect(texts.length).toBeGreaterThanOrEqual(4);

    for (const text of texts) {
      const style = StyleSheet.flatten(text.props.style);
      expect(style.color).toBe(theme.textSecondary);
      expect(contrastRatio(style.color as string, theme.bgSurface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
