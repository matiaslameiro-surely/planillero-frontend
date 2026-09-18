import { requestWithAuth } from '@/api/client';
import { getMyRouteSheet, startVisit } from '@/api/visits';

/**
 * Tests de las llamadas de la agenda.
 *
 * Se reemplaza `requestWithAuth`: lo que se verifica es que se arme bien la ruta y el cuerpo según
 * el contrato, no el transporte HTTP (eso lo cubre `client.test.ts`).
 */

jest.mock('@/api/client');

const requestWithAuthMock = requestWithAuth as jest.Mock;

afterEach(() => {
  jest.resetAllMocks();
});

describe('getMyRouteSheet', () => {
  it('pide la agenda del operador autenticado para la fecha', async () => {
    const sheet = { operatorId: 'op', operatorUsername: 'operador.demo', date: '2026-11-01', items: [] };
    requestWithAuthMock.mockResolvedValue(sheet);

    await expect(getMyRouteSheet('2026-11-01')).resolves.toBe(sheet);

    expect(requestWithAuthMock).toHaveBeenCalledWith(
      '/api/v1/operators/me/route-sheet?date=2026-11-01',
    );
  });
});

describe('startVisit', () => {
  it('hace POST a /visits/{id}/start con el cuerpo del contrato', async () => {
    const body = {
      latitude: -34.603712,
      longitude: -58.381593,
      accuracyMeters: 8.5,
      clientTimestamp: '2026-10-20T14:59:30.000Z',
    };
    requestWithAuthMock.mockResolvedValue({ visitId: 'v-1', status: 'IN_PROGRESS' });

    await startVisit('v-1', body);

    expect(requestWithAuthMock).toHaveBeenCalledWith('/api/v1/visits/v-1/start', {
      method: 'POST',
      body,
    });
  });

  it('propaga el error del backend sin traducirlo', async () => {
    const error = new Error('409');
    requestWithAuthMock.mockRejectedValue(error);

    await expect(
      startVisit('v-1', {
        latitude: 0,
        longitude: 0,
        accuracyMeters: 1,
        clientTimestamp: '2026-10-20T14:59:30.000Z',
      }),
    ).rejects.toBe(error);
  });
});
