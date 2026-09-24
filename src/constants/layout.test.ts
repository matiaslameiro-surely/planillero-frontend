import React from 'react';
import { useColorScheme } from 'react-native';
import { act, create } from 'react-test-renderer';
import {
  MIN_TOUCH_TARGET,
  ERGONOMIC_SPACING,
  HIGH_CONTRAST_COLORS,
  LIGHT_THEME,
  DARK_THEME,
  useThemeColors,
  type ThemeColors,
} from './layout';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

function testThemeColors(): ThemeColors {
  let colors!: ThemeColors;
  function Probe() {
    colors = useThemeColors();
    return null;
  }
  act(() => {
    create(React.createElement(Probe));
  });
  return colors;
}

describe('layout ergonomic constants and theme tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines MIN_TOUCH_TARGET as at least 48 dp for field gloves accessibility', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
  });

  it('defines structured spacing and color tokens', () => {
    expect(ERGONOMIC_SPACING.md).toBe(12);
    expect(ERGONOMIC_SPACING.lg).toBe(16);
    expect(HIGH_CONTRAST_COLORS.textPrimary).toBe('#0f172a');
    expect(HIGH_CONTRAST_COLORS.primary).toBe('#1d4ed8');
  });

  it('provides complete light and dark theme palettes', () => {
    expect(LIGHT_THEME.bgSurface).toBe('#ffffff');
    expect(LIGHT_THEME.bgBackdrop).toBe('#f8fafc');
    expect(LIGHT_THEME.textPrimary).toBe('#0f172a');

    expect(DARK_THEME.bgSurface).toBe('#1e293b');
    expect(DARK_THEME.bgBackdrop).toBe('#0f172a');
    expect(DARK_THEME.textPrimary).toBe('#f8fafc');
    expect(DARK_THEME.textSecondary).toBe('#cbd5e1');
  });

  it('resolves dark theme when useColorScheme is dark', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const colors = testThemeColors();
    expect(colors).toEqual(DARK_THEME);
  });

  it('resolves light theme when useColorScheme is light or null', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const colorsLight = testThemeColors();
    expect(colorsLight).toEqual(LIGHT_THEME);

    (useColorScheme as jest.Mock).mockReturnValue(null);
    const colorsNull = testThemeColors();
    expect(colorsNull).toEqual(LIGHT_THEME);
  });
});
