import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { completeVisit as postCompleteVisit, type CompleteVisitResponse } from '@/api/visits';
import { markCompleted } from '@/agenda/agendaRepository';
import { completeVisit } from '@/visit/completeVisit';

jest.mock('@/api/visits');
jest.mock('@/agenda/agendaRepository');
jest.mock('@/audit/auditRepository', () => ({
  insertTrace: jest.fn().mockResolvedValue(undefined),
}));

const post = postCompleteVisit as jest.Mock;
const mark = markCompleted as jest.Mock;

const db = {} as SQLiteDatabase;

const response: CompleteVisitResponse = {
  visitId: 'v-1',
  status: 'COMPLETED',
  code: 'V-1001',
  completedAt: '2026-11-01T15:30:00Z',
};

beforeEach(() => {
  post.mockResolvedValue(response);
  mark.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('completeVisit', () => {
  it('envía pedido, actualiza SQLite y devuelve completed', async () => {
    const outcome = await completeVisit(db, 'v-1');

    expect(post).toHaveBeenCalledWith('v-1');
    expect(mark).toHaveBeenCalledWith(db, 'v-1');
    expect(outcome).toEqual({ kind: 'completed', response });
  });

  it('si ya estaba completada (409 visit_already_completed), actualiza SQLite y devuelve alreadyCompleted', async () => {
    post.mockRejectedValue(new ApiError('Ya completada', 409, 'visit_already_completed'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).toHaveBeenCalledWith(db, 'v-1');
    expect(outcome).toEqual({ kind: 'alreadyCompleted' });
  });

  it('si no estaba en curso (409 visit_not_in_progress), devuelve failed not_in_progress y no toca SQLite', async () => {
    post.mockRejectedValue(new ApiError('No en curso', 409, 'visit_not_in_progress'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('not_in_progress');
    }
  });

  it('si la visita ya no está asignada (403), devuelve failed not_assigned', async () => {
    post.mockRejectedValue(new ApiError('No asignada', 403, 'visit_not_assigned'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('not_assigned');
      expect(outcome.message).toBe('Esta visita ya no está asignada a vos. Actualizá la agenda.');
    }
  });

  it('si la visita no existe o fue eliminada (404), devuelve failed not_found', async () => {
    post.mockRejectedValue(new ApiError('No encontrada', 404, 'visit_not_found'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('not_found');
      expect(outcome.message).toBe('La visita no existe o fue eliminada.');
    }
  });

  it('si falla el servidor (500), devuelve failed server', async () => {
    post.mockRejectedValue(new ApiError('Error de servidor', 500, 'server_error'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('server');
    }
  });

  it('si no hay conexión, devuelve failed offline', async () => {
    post.mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await completeVisit(db, 'v-1');

    expect(mark).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('offline');
    }
  });
});
