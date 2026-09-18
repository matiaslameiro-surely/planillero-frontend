import { accuracyLevel } from '@/visit/accuracy';

describe('accuracyLevel', () => {
  it.each([
    [0, 'green'],
    [5, 'green'],
    [14.9, 'green'],
    [15, 'yellow'],
    [30, 'yellow'],
    [50, 'yellow'],
    [50.1, 'red'],
    [200, 'red'],
  ])('%p m es %s', (meters, expected) => {
    expect(accuracyLevel(meters)).toBe(expected);
  });

  it.each([[-1], [NaN], [Infinity], [-Infinity]])('%p no es una lectura real y da rojo', (meters) => {
    expect(accuracyLevel(meters)).toBe('red');
  });
});
