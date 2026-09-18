import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { startVisit as postStartVisit, type StartVisitResponse } from '@/api/visits';
import { markStarted } from '@/agenda/agendaRepository';
import { captureLocation, LocationError } from '@/visit/location';
import { startVisit } from '@/visit/startVisit';

/**
 * Tests de la orquestación del inicio de visita.
 *
 * Se reemplazan la captura de ubicación, la llamada al backend y el repositorio: acá se verifica el
 * orden, la traducción de cada falla y que ante un error no se toque la base local.
 */

jest.mock('@/visit/location', () => {
  const actual = jest.requireActual('@/visit/location');
  return { ...actual, captureLocation: jest.fn() };
});
jest.mock('@/api/visits');
jest.mock('@/agenda/agendaRepository');

const capture = captureLocation as jest.Mock;
const post = postStartVisit as jest.Mock;
const mark = markStarted as jest.Mock;

const db = {} as SQLiteDatabase;

const location = {
  latitude: -34.603712,
  longitude: -58.381593,
  accuracyMeters: 8.5,
  capturedAt: Date.parse('2026-11-01T14:59:30Z'),
};

const response: StartVisitResponse = {
  visitId: 'v-1',
  status: 'IN_PROGRESS',
  latitude: -34.603712,
  longitude: -58.381593,
  accuracyMeters: 8.5,
  startedAtDevice: '2026-11-01T14:59:30Z',
  startedAtServer: '2026-11-01T15:00:00Z',
  driftSeconds: 30,
};

beforeEach(() => {
  capture.mockResolvedValue(location);
  post.mockResolvedValue(response);
  mark.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('startVisit', () => {
  it('captura, envía con la hora del dispositivo en ISO y actualiza SQLite', async () => {
    const outcome = await startVisit(db, 'v-1');

    expect(outcome).toEqual({ kind: 'started', response });
    expect(post).toHaveBeenCalledWith('v-1', {
      latitude: -34.603712,
      longitude: -58.381593,
      accuracyMeters: 8.5,
      clientTimestamp: '2026-11-01T14:59:30.000Z',
    });
    expect(mark).toHaveBeenCalledWith(db, response);
  });

  it.each([
    ['permission_denied'],
    ['services_disabled'],
    ['mock_location'],
    ['no_fix'],
  ] as const)('si la captura falla con %s no toca la red ni SQLite', async (code) => {
    capture.mockRejectedValue(new LocationError('x', code));

    const outcome = await startVisit(db, 'v-1');

    expect(outcome).toMatchObject({ kind: 'failed', reason: code });
    expect(post).not.toHaveBeenCalled();
    expect(mark).not.toHaveBeenCalled();
  });

  it('una ubicación simulada dice con claridad por qué no se inicia', async () => {
    capture.mockRejectedValue(new LocationError('x', 'mock_location'));

    const outcome = await startVisit(db, 'v-1');

    expect(outcome).toMatchObject({ kind: 'failed' });
    expect((outcome as { message: string }).message).toContain('simulada');
  });

  it('un error inesperado al capturar se informa como no_fix', async () => {
    capture.mockRejectedValue(new Error('rompió'));

    await expect(startVisit(db, 'v-1')).resolves.toMatchObject({ kind: 'failed', reason: 'no_fix' });
  });

  it('un 409 significa que ya estaba iniciada y no cambia SQLite', async () => {
    post.mockRejectedValue(new ApiError('ya iniciada', 409, 'visit_not_startable'));

    await expect(startVisit(db, 'v-1')).resolves.toEqual({ kind: 'alreadyStarted' });
    expect(mark).not.toHaveBeenCalled();
  });

  it.each([[403], [404]])('un %s significa que la visita ya no es del operador', async (status) => {
    post.mockRejectedValue(new ApiError('no', status, 'visit_not_assigned'));

    await expect(startVisit(db, 'v-1')).resolves.toMatchObject({
      kind: 'failed',
      reason: 'not_assigned',
    });
    expect(mark).not.toHaveBeenCalled();
  });

  it('un error del servidor se informa como server', async () => {
    post.mockRejectedValue(new ApiError('boom', 500, 'unknown_error'));

    await expect(startVisit(db, 'v-1')).resolves.toMatchObject({ kind: 'failed', reason: 'server' });
    expect(mark).not.toHaveBeenCalled();
  });

  it('un fallo de red se informa como offline', async () => {
    post.mockRejectedValue(new TypeError('Network request failed'));

    await expect(startVisit(db, 'v-1')).resolves.toMatchObject({ kind: 'failed', reason: 'offline' });
    expect(mark).not.toHaveBeenCalled();
  });

  it('si el servidor registró el inicio pero falla SQLite, igual informa que se inició', async () => {
    mark.mockRejectedValue(new Error('disco lleno'));

    await expect(startVisit(db, 'v-1')).resolves.toEqual({ kind: 'started', response });
  });
});
