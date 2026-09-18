import type { SQLiteDatabase } from 'expo-sqlite';

import type { RouteSheet, StartVisitResponse } from '@/api/visits';
import {
  countPending,
  lastSync,
  listDay,
  markStarted,
  replaceDay,
  toAgendaVisit,
  type AgendaRow,
} from '@/agenda/agendaRepository';

/**
 * Tests del repositorio de la agenda.
 *
 * SQLite es código nativo y no corre en Jest: se usa un doble de la base que registra las sentencias.
 * Se verifica el mapeo, la transaccionalidad y los parámetros de cada consulta. Que el SQL se ejecute
 * bien sobre SQLite real sólo se comprueba en un development build (ver `02-plan.md`).
 */

function fakeDb() {
  const calls: { sql: string; params: unknown[]; inTransaction: boolean }[] = [];
  let inTransaction = false;
  const db = {
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      inTransaction = true;
      try {
        await task();
      } finally {
        inTransaction = false;
      }
    }),
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params, inTransaction });
    }),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  };
  return { db, calls, asDatabase: db as unknown as SQLiteDatabase };
}

const sheet: RouteSheet = {
  operatorId: 'op-1',
  operatorUsername: 'operador.demo',
  date: '2026-11-01',
  items: [
    {
      position: 1,
      visit: {
        id: 'v-1',
        code: 'V-1001',
        address: 'Calle Ficticia 1',
        latitude: -34.5,
        longitude: -58.4,
        status: 'ASSIGNED',
        urgency: 'HIGH',
      },
    },
    {
      position: 2,
      visit: {
        id: 'v-2',
        code: 'V-1002',
        address: 'Calle Ficticia 2',
        latitude: -34.6,
        longitude: -58.5,
        status: 'ASSIGNED',
        urgency: 'LOW',
      },
    },
  ],
};

const baseRow: AgendaRow = {
  route_date: '2026-11-01',
  visit_id: 'v-1',
  position: 1,
  code: 'V-1001',
  address: 'Calle Ficticia 1',
  latitude: -34.5,
  longitude: -58.4,
  status: 'ASSIGNED',
  urgency: 'HIGH',
  start_latitude: null,
  start_longitude: null,
  start_accuracy_meters: null,
  started_at_server: null,
};

describe('toAgendaVisit', () => {
  it('mapea una visita sin evidencia de inicio', () => {
    expect(toAgendaVisit(baseRow)).toEqual({
      visitId: 'v-1',
      routeDate: '2026-11-01',
      position: 1,
      code: 'V-1001',
      address: 'Calle Ficticia 1',
      latitude: -34.5,
      longitude: -58.4,
      status: 'ASSIGNED',
      urgency: 'HIGH',
      start: null,
    });
  });

  it('mapea la evidencia de inicio cuando está completa', () => {
    const visit = toAgendaVisit({
      ...baseRow,
      status: 'IN_PROGRESS',
      start_latitude: -34.503,
      start_longitude: -58.401,
      start_accuracy_meters: 8.5,
      started_at_server: '2026-11-01T15:00:00Z',
    });

    expect(visit.start).toEqual({
      latitude: -34.503,
      longitude: -58.401,
      accuracyMeters: 8.5,
      startedAt: '2026-11-01T15:00:00Z',
    });
  });

  it('no inventa la evidencia si falta alguno de sus datos', () => {
    const visit = toAgendaVisit({ ...baseRow, status: 'IN_PROGRESS', start_latitude: -34.5 });

    expect(visit.start).toBeNull();
  });
});

describe('replaceDay', () => {
  it('hace todo dentro de una transacción', async () => {
    const { calls, asDatabase, db } = fakeDb();

    await replaceDay(asDatabase, sheet, '2026-11-01T14:00:00Z');

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.inTransaction)).toBe(true);
  });

  it('inserta cada visita con su posición y no toca la evidencia de inicio', async () => {
    const { calls, asDatabase } = fakeDb();

    await replaceDay(asDatabase, sheet, '2026-11-01T14:00:00Z');

    const upserts = calls.filter((call) => call.sql.includes('INSERT INTO agenda_visits'));
    expect(upserts).toHaveLength(2);
    expect(upserts[0].params.slice(0, 3)).toEqual(['2026-11-01', 'v-1', 1]);
    expect(upserts[1].params.slice(0, 3)).toEqual(['2026-11-01', 'v-2', 2]);
    // El upsert no debe pisar las columnas start_* que sólo conoce este dispositivo.
    expect(upserts[0].sql).not.toContain('start_');
  });

  it('borra lo que ya no figura en la agenda del día', async () => {
    const { calls, asDatabase } = fakeDb();

    await replaceDay(asDatabase, sheet, '2026-11-01T14:00:00Z');

    const cleanup = calls.find((call) => call.sql.startsWith('DELETE FROM agenda_visits'));
    expect(cleanup?.sql).toContain('NOT IN (?, ?)');
    expect(cleanup?.params).toEqual(['2026-11-01', 'v-1', 'v-2']);
  });

  it('con la agenda vacía borra todo el día', async () => {
    const { calls, asDatabase } = fakeDb();

    await replaceDay(asDatabase, { ...sheet, items: [] }, '2026-11-01T14:00:00Z');

    const cleanup = calls.find((call) => call.sql.startsWith('DELETE FROM agenda_visits'));
    expect(cleanup?.sql).not.toContain('NOT IN');
    expect(cleanup?.params).toEqual(['2026-11-01']);
  });

  it('registra cuándo se sincronizó', async () => {
    const { calls, asDatabase } = fakeDb();

    await replaceDay(asDatabase, sheet, '2026-11-01T14:00:00Z');

    const sync = calls.find((call) => call.sql.includes('agenda_sync'));
    expect(sync?.params).toEqual(['2026-11-01', '2026-11-01T14:00:00Z']);
  });

  it('propaga el error si una sentencia falla, para que la transacción se revierta', async () => {
    const { db, asDatabase } = fakeDb();
    db.runAsync.mockRejectedValueOnce(new Error('disco lleno'));

    await expect(replaceDay(asDatabase, sheet, '2026-11-01T14:00:00Z')).rejects.toThrow('disco lleno');
  });
});

describe('lecturas', () => {
  it('listDay pide el día ordenado por posición y mapea las filas', async () => {
    const { db, asDatabase } = fakeDb();
    db.getAllAsync.mockResolvedValue([baseRow]);

    const visits = await listDay(asDatabase, '2026-11-01');

    expect(db.getAllAsync.mock.calls[0][0]).toContain('ORDER BY position ASC');
    expect(db.getAllAsync.mock.calls[0][1]).toEqual(['2026-11-01']);
    expect(visits).toHaveLength(1);
    expect(visits[0].code).toBe('V-1001');
  });

  it('countPending cuenta sólo las visitas ASSIGNED', async () => {
    const { db, asDatabase } = fakeDb();
    db.getFirstAsync.mockResolvedValue({ total: 3 });

    await expect(countPending(asDatabase, '2026-11-01')).resolves.toBe(3);
    expect(db.getFirstAsync.mock.calls[0][0]).toContain("status = 'ASSIGNED'");
  });

  it('countPending da 0 si no hay fila', async () => {
    const { db, asDatabase } = fakeDb();
    db.getFirstAsync.mockResolvedValue(null);

    await expect(countPending(asDatabase, '2026-11-01')).resolves.toBe(0);
  });

  it('lastSync devuelve null si el día nunca se sincronizó', async () => {
    const { db, asDatabase } = fakeDb();
    db.getFirstAsync.mockResolvedValue(null);

    await expect(lastSync(asDatabase, '2026-11-01')).resolves.toBeNull();
  });

  it('lastSync devuelve la fecha guardada', async () => {
    const { db, asDatabase } = fakeDb();
    db.getFirstAsync.mockResolvedValue({ synced_at: '2026-11-01T14:00:00Z' });

    await expect(lastSync(asDatabase, '2026-11-01')).resolves.toBe('2026-11-01T14:00:00Z');
  });
});

describe('markStarted', () => {
  it('pasa la visita a IN_PROGRESS con la evidencia que confirmó el servidor', async () => {
    const { calls, asDatabase } = fakeDb();
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

    await markStarted(asDatabase, response);

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("status = 'IN_PROGRESS'");
    expect(calls[0].params).toEqual([-34.603712, -58.381593, 8.5, '2026-11-01T15:00:00Z', 'v-1']);
  });
});
