import { TIMEOUT_MS, URL_API } from '@/constants/env';

/**
 * Resultado de consultar la salud del backend.
 *
 * Es una unión discriminada y no un objeto con campos opcionales a propósito: obliga a quien lo
 * consume a contemplar el caso de error, en vez de permitir leer `momento` cuando no hay conexión.
 */
export type ResultadoSalud =
  | { estado: 'conectado'; momento: string }
  | { estado: 'error'; motivo: string };

/** Respuesta esperada de `GET /salud`. */
interface RespuestaSalud {
  estado: string;
  momento: string;
}

/**
 * Consulta el endpoint de salud del backend.
 *
 * Nunca lanza: los fallos de red son un estado esperado de una app móvil, no una excepción. Quien
 * llama recibe siempre un `ResultadoSalud` y decide qué mostrar.
 */
export async function obtenerSalud(): Promise<ResultadoSalud> {
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${URL_API}/salud`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controlador.signal,
    });

    if (!respuesta.ok) {
      return { estado: 'error', motivo: `El backend respondió ${respuesta.status}.` };
    }

    const cuerpo = (await respuesta.json()) as Partial<RespuestaSalud>;
    if (cuerpo?.estado !== 'ok') {
      return { estado: 'error', motivo: `El backend informó estado "${cuerpo?.estado ?? 'desconocido'}".` };
    }

    return { estado: 'conectado', momento: cuerpo.momento ?? '' };
  } catch (error) {
    // `AbortError` es el timeout de arriba; el resto son fallos de red o respuestas no parseables.
    const esTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      estado: 'error',
      motivo: esTimeout
        ? `El backend no respondió en ${TIMEOUT_MS / 1000} segundos.`
        : `No se pudo conectar con ${URL_API}.`,
    };
  } finally {
    clearTimeout(reloj);
  }
}
