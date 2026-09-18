/**
 * Fecha local `YYYY-MM-DD` del dispositivo.
 *
 * "Hoy" lo define el reloj y la zona horaria del dispositivo. No se usa `toISOString()` porque pasa a
 * UTC y, de noche, devolvería la fecha de mañana.
 */
export function localDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
