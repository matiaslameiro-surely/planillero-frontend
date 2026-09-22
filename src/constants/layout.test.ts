import { MIN_TOUCH_TARGET, ERGONOMIC_SPACING, HIGH_CONTRAST_COLORS } from './layout';

describe('layout ergonomic constants', () => {
  it('defines MIN_TOUCH_TARGET as at least 48 dp for field gloves accessibility', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
  });

  it('defines structured spacing and color tokens', () => {
    expect(ERGONOMIC_SPACING.md).toBe(12);
    expect(ERGONOMIC_SPACING.lg).toBe(16);
    expect(HIGH_CONTRAST_COLORS.textPrimary).toBe('#0f172a');
    expect(HIGH_CONTRAST_COLORS.primary).toBe('#1d4ed8');
  });
});
