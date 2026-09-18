import { localDateString } from '@/agenda/date';

describe('localDateString', () => {
  it('da la fecha local con ceros a la izquierda', () => {
    expect(localDateString(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('no salta al día siguiente de noche, como haría toISOString en UTC', () => {
    // 23:30 locales del 20/10: en una zona al oeste de UTC, toISOString ya daría el 21.
    expect(localDateString(new Date(2026, 9, 20, 23, 30, 0))).toBe('2026-10-20');
  });

  it('respeta fin de año', () => {
    expect(localDateString(new Date(2026, 11, 31, 0, 0, 0))).toBe('2026-12-31');
  });
});
