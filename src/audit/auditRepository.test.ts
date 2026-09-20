import type { SQLiteDatabase } from 'expo-sqlite';

import { insertTrace, listTraces, type AuditTrace } from '@/audit/auditRepository';

/**
 * Tests del repositorio de trazas locales de auditoría.
 *
 * Mismo enfoque que `agendaRepository.test.ts`: SQLite no corre en Jest, así que se usa un doble
 * de la base que registra las sentencias y devuelve filas fabricadas.
 */

function fakeDb(rows: unknown[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
    }),
    getAllAsync: jest.fn(async () => rows),
  };
  return { db, calls, asDatabase: db as unknown as SQLiteDatabase };
}

describe('insertTrace', () => {
  it('inserta la traza con los datos de la visita y el evento', async () => {
    const { db, calls, asDatabase } = fakeDb();

    await insertTrace(asDatabase, 'visit-1', 'VISIT_STARTED', { latitude: -34.6, longitude: -58.4 });

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const [call] = calls;
    expect(call.sql).toContain('INSERT INTO visit_audit_traces');
    const [id, visitId, eventType, occurredAt, metadata] = call.params as [
      string,
      string,
      string,
      string,
      string,
    ];
    expect(id).toBeTruthy();
    expect(visitId).toBe('visit-1');
    expect(eventType).toBe('VISIT_STARTED');
    expect(() => new Date(occurredAt).toISOString()).not.toThrow();
    expect(JSON.parse(metadata)).toEqual({ latitude: -34.6, longitude: -58.4 });
  });

  it('guarda metadata nula cuando no se pasa', async () => {
    const { calls, asDatabase } = fakeDb();

    await insertTrace(asDatabase, 'visit-1', 'EVIDENCE_SAVED');

    expect(calls[0].params[4]).toBeNull();
  });
});

describe('listTraces', () => {
  it('mapea las filas crudas a AuditTrace, en orden', async () => {
    const { asDatabase } = fakeDb([
      {
        id: 't-1',
        visit_id: 'visit-1',
        event_type: 'VISIT_STARTED',
        occurred_at: '2026-11-10T15:00:00.000Z',
        metadata: '{"latitude":-34.6}',
      },
      {
        id: 't-2',
        visit_id: 'visit-1',
        event_type: 'EVIDENCE_SAVED',
        occurred_at: '2026-11-10T15:05:00.000Z',
        metadata: null,
      },
    ]);

    const traces: AuditTrace[] = await listTraces(asDatabase, 'visit-1');

    expect(traces).toEqual([
      {
        id: 't-1',
        visitId: 'visit-1',
        eventType: 'VISIT_STARTED',
        occurredAt: '2026-11-10T15:00:00.000Z',
        metadata: { latitude: -34.6 },
      },
      {
        id: 't-2',
        visitId: 'visit-1',
        eventType: 'EVIDENCE_SAVED',
        occurredAt: '2026-11-10T15:05:00.000Z',
        metadata: null,
      },
    ]);
  });
});
