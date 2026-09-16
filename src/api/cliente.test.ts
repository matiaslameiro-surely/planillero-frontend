import { obtenerSalud } from '@/api/cliente';

/**
 * Tests del cliente HTTP.
 *
 * Se reemplaza `fetch` en lugar de levantar el backend: los tests tienen que correr en cualquier
 * máquina y en CI, sin depender de que haya un servidor arriba. Lo que se verifica acá es cómo
 * traduce el cliente cada respuesta posible, que es su única responsabilidad.
 */

const fetchOriginal = global.fetch;

function simularFetch(implementacion: jest.Mock) {
  global.fetch = implementacion as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = fetchOriginal;
  jest.clearAllMocks();
});

describe('obtenerSalud', () => {
  it('devuelve conectado cuando el backend responde ok', async () => {
    simularFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ estado: 'ok', momento: '2026-09-16T12:00:00Z' }),
      }),
    );

    const resultado = await obtenerSalud();

    expect(resultado).toEqual({ estado: 'conectado', momento: '2026-09-16T12:00:00Z' });
  });

  it('consulta la ruta /salud del backend', async () => {
    const espia = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ estado: 'ok', momento: '' }),
    });
    simularFetch(espia);

    await obtenerSalud();

    expect(espia).toHaveBeenCalledTimes(1);
    expect(String(espia.mock.calls[0][0])).toMatch(/\/salud$/);
  });

  it('devuelve error cuando no hay conexión', async () => {
    simularFetch(jest.fn().mockRejectedValue(new TypeError('Network request failed')));

    const resultado = await obtenerSalud();

    expect(resultado.estado).toBe('error');
    if (resultado.estado === 'error') {
      expect(resultado.motivo).toContain('No se pudo conectar');
    }
  });

  it('devuelve error cuando el backend responde con un código de error', async () => {
    simularFetch(jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));

    const resultado = await obtenerSalud();

    expect(resultado.estado).toBe('error');
    if (resultado.estado === 'error') {
      expect(resultado.motivo).toContain('503');
    }
  });

  it('devuelve error cuando el backend responde un estado distinto de ok', async () => {
    simularFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ estado: 'degradado', momento: '' }),
      }),
    );

    const resultado = await obtenerSalud();

    expect(resultado.estado).toBe('error');
    if (resultado.estado === 'error') {
      expect(resultado.motivo).toContain('degradado');
    }
  });
});
