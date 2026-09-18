/** Nivel del semáforo de precisión del GPS. */
export type AccuracyLevel = 'green' | 'yellow' | 'red';

/** Por debajo de este radio (en metros) la lectura es buena. */
export const GREEN_MAX_METERS = 15;

/** Hasta este radio (en metros, inclusive) la lectura es aceptable. Más allá es mala. */
export const YELLOW_MAX_METERS = 50;

/**
 * Traduce el radio de incertidumbre de una lectura GPS al color del semáforo.
 *
 * - verde: menos de 15 m
 * - amarillo: de 15 m a 50 m (ambos incluidos)
 * - rojo: más de 50 m
 *
 * Un valor que no es un número finito o es negativo no describe una lectura real, así que se
 * clasifica como rojo: ante la duda, no se acredita la presencia.
 */
export function accuracyLevel(meters: number): AccuracyLevel {
  if (!Number.isFinite(meters) || meters < 0) {
    return 'red';
  }
  if (meters < GREEN_MAX_METERS) {
    return 'green';
  }
  if (meters <= YELLOW_MAX_METERS) {
    return 'yellow';
  }
  return 'red';
}
