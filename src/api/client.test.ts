import * as tokenStore from '@/auth/tokenStore';
import { ApiError, getHealth, requestWithAuth } from '@/api/client';

/**
 * Tests del cliente HTTP.
 *
 * Se reemplazan `fetch` y el almacén de tokens en lugar de levantar el backend: los tests tienen que
 * correr en cualquier máquina y en CI, sin depender de que haya un servidor arriba. Lo que se
 * verifica acá es la responsabilidad del cliente: traducir respuestas y manejar el ciclo del token.
 */

jest.mock('@/auth/tokenStore');

const readTokens = tokenStore.readTokens as jest.Mock;
const saveTokens = tokenStore.saveTokens as jest.Mock;
const clearTokens = tokenStore.clearTokens as jest.Mock;

const fetchOriginal = global.fetch;

function useFetch(implementation: jest.Mock) {
  global.fetch = implementation as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(status: number, text: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

beforeEach(() => {
  readTokens.mockReset();
  saveTokens.mockReset();
  clearTokens.mockReset();
});

afterEach(() => {
  global.fetch = fetchOriginal;
  jest.clearAllMocks();
});

describe('getHealth', () => {
  it('devuelve connected cuando el backend responde ok', async () => {
    useFetch(
      jest.fn().mockResolvedValue(jsonResponse(200, { estado: 'ok', momento: '2026-09-16T12:00:00Z' })),
    );

    const result = await getHealth();

    expect(result).toEqual({ status: 'connected', at: '2026-09-16T12:00:00Z' });
  });

  it('consulta la ruta /salud del backend', async () => {
    const spy = jest.fn().mockResolvedValue(jsonResponse(200, { estado: 'ok', momento: '' }));
    useFetch(spy);

    await getHealth();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(urlOf(spy.mock.calls[0])).toMatch(/\/salud$/);
  });

  it('devuelve error cuando no hay conexión', async () => {
    useFetch(jest.fn().mockRejectedValue(new TypeError('Network request failed')));

    const result = await getHealth();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('No se pudo conectar');
    }
  });

  it('devuelve error cuando el backend responde con un código de error', async () => {
    useFetch(jest.fn().mockResolvedValue(textResponse(503, 'sin servicio')));

    const result = await getHealth();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('503');
    }
  });

  it('devuelve error cuando el backend responde un estado distinto de ok', async () => {
    useFetch(jest.fn().mockResolvedValue(jsonResponse(200, { estado: 'degradado', momento: '' })));

    const result = await getHealth();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('degradado');
    }
  });
});

describe('requestWithAuth', () => {
  it('adjunta el Bearer de la sesión guardada', async () => {
    readTokens.mockResolvedValue({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    const spy = jest.fn().mockResolvedValue(jsonResponse(200, { username: 'operador.demo' }));
    useFetch(spy);

    await requestWithAuth('/auth/me');

    const options = spy.mock.calls[0][1] as { headers: Record<string, string> };
    expect(options.headers.Authorization).toBe('Bearer access-1');
  });

  it('falla sin sesión sin llegar a hacer la petición', async () => {
    readTokens.mockResolvedValue(null);
    const spy = jest.fn();
    useFetch(spy);

    await expect(requestWithAuth('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ante un 401 refresca la sesión y reintenta la petición', async () => {
    readTokens.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'refresh-1' });
    let meRequests = 0;
    const spy = jest.fn((url: string, _options?: unknown) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { accessToken: 'nuevo', refreshToken: 'refresh-2' }));
      }
      if (url.endsWith('/auth/me')) {
        meRequests += 1;
        return Promise.resolve(
          meRequests === 1
            ? jsonResponse(401, { error: 'token_expired', message: 'El token venció.' })
            : jsonResponse(200, { username: 'operador.demo' }),
        );
      }
      return Promise.resolve(textResponse(404, ''));
    });
    useFetch(spy);

    const result = await requestWithAuth<{ username: string }>('/auth/me');

    expect(result.username).toBe('operador.demo');
    expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'nuevo', refreshToken: 'refresh-2' });
    const ultima = spy.mock.calls[spy.mock.calls.length - 1];
    expect((ultima[1] as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer nuevo');
  });

  it('si el refresh también falla, borra los tokens y propaga el error', async () => {
    readTokens.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'vencido' });
    useFetch(
      jest.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/auth/refresh')
            ? jsonResponse(401, { error: 'invalid_refresh_token', message: 'Refresh inválido.' })
            : jsonResponse(401, { error: 'token_expired', message: 'El token venció.' }),
        ),
      ),
    );

    await expect(requestWithAuth('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(clearTokens).toHaveBeenCalled();
  });
});
