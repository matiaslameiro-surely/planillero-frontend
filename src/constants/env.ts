/**
 * Variables de entorno de la aplicación.
 *
 * Se leen **sólo acá**: el resto del código importa de este módulo y nunca toca `process.env`
 * directamente. Así hay un único lugar donde ver qué configura la app y qué pasa si algo falta.
 *
 * El prefijo `EXPO_PUBLIC_` no es decorativo: es lo que hace que Expo incluya la variable en el
 * bundle. Una variable sin ese prefijo llega como `undefined` en tiempo de ejecución.
 *
 * Como van al bundle, **nunca** pongas secretos acá: cualquiera que tenga el APK puede leerlos.
 */

/** URL base del backend, sin barra final. */
export const URL_API: string = normalizarUrl(
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080',
);

/** Milisegundos antes de dar por perdida una petición. */
export const TIMEOUT_MS = 10_000;

function normalizarUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
