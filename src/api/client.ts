import { API_URL, TIMEOUT_MS } from '@/constants/env';
import { clearTokens, readTokens, saveTokens, type Tokens } from '@/auth/tokenStore';

/** Cuerpo de error uniforme que devuelve el backend. */
interface ApiErrorBody {
  error?: string;
  message?: string;
}

/**
 * Error de una petición a la API.
 *
 * Lleva el código HTTP y el código de negocio del backend para que quien llama pueda decidir sin
 * volver a mirar la respuesta.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
}

/**
 * Hace una petición al backend y devuelve el cuerpo ya parseado.
 *
 * Lanza `ApiError` cuando el backend responde con un código de error, y deja pasar los fallos de red
 * (por ejemplo, un `TypeError` porque no hay conexión) para que el llamador los traduzca.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = parseJson(await response.text());

    if (!response.ok) {
      const error = (payload ?? {}) as ApiErrorBody;
      throw new ApiError(
        error.message ?? `El backend respondió ${response.status}.`,
        response.status,
        error.error ?? 'unknown_error',
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): unknown {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Renovación en curso, compartida para no golpear `/auth/refresh` varias veces a la vez. */
let renewal: Promise<Tokens> | null = null;

/**
 * Renueva la sesión con el refresh token.
 *
 * Si el backend rechaza el refresh, cierra la sesión local: un refresh inválido significa que hay
 * que volver a loguearse y no tiene sentido conservar tokens que ya no sirven.
 */
export function renewSession(refreshToken: string): Promise<Tokens> {
  if (!renewal) {
    renewal = doRenew(refreshToken).finally(() => {
      renewal = null;
    });
  }
  return renewal;
}

async function doRenew(refreshToken: string): Promise<Tokens> {
  try {
    const tokens = await request<Tokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    await saveTokens(tokens);
    return tokens;
  } catch (error) {
    await clearTokens();
    throw error instanceof ApiError
      ? error
      : new ApiError('La sesión venció.', 401, 'session_expired');
  }
}

/**
 * Petición autenticada: adjunta el Bearer y, ante un 401, refresca la sesión y reintenta una vez.
 *
 * Es el único punto donde vive esa lógica, así que ninguna pantalla ni servicio tiene que saber
 * cómo se renueva una sesión.
 */
export async function requestWithAuth<T>(
  path: string,
  options: Omit<RequestOptions, 'accessToken'> = {},
): Promise<T> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new ApiError('No hay una sesión activa.', 401, 'no_session');
  }

  try {
    return await request<T>(path, { ...options, accessToken: tokens.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    const renewed = await renewSession(tokens.refreshToken);
    return request<T>(path, { ...options, accessToken: renewed.accessToken });
  }
}

/**
 * Resultado de consultar la salud del backend.
 *
 * Es una unión discriminada y no un objeto con campos opcionales a propósito: obliga a quien lo
 * consume a contemplar el caso de error, en vez de permitir leer la hora cuando no hay conexión.
 */
export type HealthResult =
  | { status: 'connected'; at: string }
  | { status: 'error'; reason: string };

/** Respuesta de `GET /salud`. Las claves son las del backend y no se traducen. */
interface HealthResponse {
  estado: string;
  momento: string;
}

/**
 * Consulta el endpoint de salud del backend.
 *
 * Nunca lanza: los fallos de red son un estado esperado de una app móvil, no una excepción. Quien
 * llama recibe siempre un `HealthResult` y decide qué mostrar.
 */
export async function getHealth(): Promise<HealthResult> {
  try {
    const body = await request<HealthResponse>('/salud');
    if (body?.estado !== 'ok') {
      return {
        status: 'error',
        reason: `El backend informó estado "${body?.estado ?? 'desconocido'}".`,
      };
    }
    return { status: 'connected', at: body.momento ?? '' };
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: 'error', reason: error.message };
    }
    // `AbortError` es el timeout de arriba; el resto son fallos de red.
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'error',
      reason: isTimeout
        ? `El backend no respondió en ${TIMEOUT_MS / 1000} segundos.`
        : `No se pudo conectar con ${API_URL}.`,
    };
  }
}
