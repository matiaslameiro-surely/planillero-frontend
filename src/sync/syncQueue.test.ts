import type { SQLiteDatabase } from 'expo-sqlite';

import {
  assignBatchKey,
  clearBatchKey,
  countPendingOperations,
  enqueueVisitForm,
  markFailed,
  nextBatch,
  removeOperations,
  type QueueRow,
} from '@/sync/syncQueue';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-2222-4333-8444-555555555555'),
}));

/**
 * Tests de la cola de sincronización.
 *
 * SQLite es código nativo y no corre en Jest: se usa un doble de la base que registra las sentencias,
 * igual que en el repositorio de la agenda. Se verifican los parámetros y la forma de cada consulta;
 * que el SQL corra sobre SQLite real se comprueba en un development build.
 */
function fakeDb(rows: QueueRow[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
    }),
    getAllAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      // El doble no interpreta SQL: devuelve las filas que le pasó el test, filtrando sólo por lo
      // único que distingue a las dos consultas de `nextBatch`.
      return sql.includes('batch_key IS NOT NULL')
        ? rows.filter((row) => row.batch_key !== null)
        : rows.filter((row) => row.batch_key === null);
    }),
    getFirstAsync: jest.fn(async () => ({ total: rows.length })),
  };
  return { db, calls, asDatabase: db as unknown as SQLiteDatabase };
}

function row(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    client_operation_id: 'op-1',
    type: 'VISIT_FORM',
    visit_id: 'v-1',
    payload_json: JSON.stringify({ templateKey: 'mantenimiento-general', responses: {} }),
    status: 'pending',
    attempts: 0,
    batch_key: null,
    last_error: null,
    created_at: '2026-09-21T10:00:00.000Z',
    updated_at: '2026-09-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('enqueueVisitForm', () => {
  it('guarda la operación como pendiente y devuelve su identificador', async () => {
    const { asDatabase, calls } = fakeDb();

    const id = await enqueueVisitForm(asDatabase, 'v-1', {
      templateKey: 'mantenimiento-general',
      responses: { workedHours: 8 },
    });

    expect(id).toBe('11111111-2222-4333-8444-555555555555');
    expect(calls[0].sql).toContain('INSERT INTO sync_queue');
    expect(calls[0].params[0]).toBe(id);
    expect(calls[0].params[1]).toBe('v-1');
    expect(JSON.parse(calls[0].params[2] as string)).toEqual({
      templateKey: 'mantenimiento-general',
      responses: { workedHours: 8 },
    });
  });

  it('el payload se guarda entero: es lo que se va a enviar tal cual', async () => {
    const { asDatabase, calls } = fakeDb();
    const form = {
      templateKey: 'mantenimiento-general',
      templateVersion: 2,
      responses: { workedHours: 7.5, observations: "'; drop table sync_queue; --" },
    };

    await enqueueVisitForm(asDatabase, 'v-1', form);

    // El texto con SQL adentro viaja como parámetro, no como parte de la sentencia.
    expect(JSON.parse(calls[0].params[2] as string)).toEqual(form);
    expect(calls[0].sql).not.toContain('drop table');
  });
});

describe('nextBatch', () => {
  it('devuelve las operaciones nuevas cuando no hay nada a medio enviar', async () => {
    const { asDatabase } = fakeDb([row({ client_operation_id: 'op-1' }), row({ client_operation_id: 'op-2' })]);

    const batch = await nextBatch(asDatabase);

    expect(batch.map((operation) => operation.clientOperationId)).toEqual(['op-1', 'op-2']);
    expect(batch[0].batchKey).toBeNull();
  });

  it('prioriza el lote a medio enviar y no lo mezcla con operaciones nuevas', async () => {
    // Éste es el caso que protege de un 409 por clave reutilizada: si el reintento saliera con
    // operaciones nuevas adentro, el cuerpo ya no sería el mismo que el del envío original.
    const { asDatabase } = fakeDb([
      row({ client_operation_id: 'op-vieja', batch_key: 'lote-1' }),
      row({ client_operation_id: 'op-otra-clave', batch_key: 'lote-2' }),
      row({ client_operation_id: 'op-nueva' }),
    ]);

    const batch = await nextBatch(asDatabase);

    expect(batch.map((operation) => operation.clientOperationId)).toEqual(['op-vieja']);
    expect(batch[0].batchKey).toBe('lote-1');
  });

  it('con la cola vacía devuelve un lote vacío', async () => {
    const { asDatabase } = fakeDb([]);

    expect(await nextBatch(asDatabase)).toEqual([]);
  });
});

describe('assignBatchKey', () => {
  it('guarda la clave y suma un intento', async () => {
    const { asDatabase, calls } = fakeDb();

    await assignBatchKey(asDatabase, ['op-1', 'op-2'], 'lote-1');

    expect(calls[0].sql).toContain('attempts = attempts + 1');
    expect(calls[0].params[0]).toBe('lote-1');
    expect(calls[0].params.slice(2)).toEqual(['op-1', 'op-2']);
  });

  it('sin operaciones no toca la base', async () => {
    const { asDatabase, calls } = fakeDb();

    await assignBatchKey(asDatabase, [], 'lote-1');

    expect(calls).toHaveLength(0);
  });
});

describe('removeOperations y markFailed', () => {
  it('las operaciones cerradas se borran de la cola', async () => {
    const { asDatabase, calls } = fakeDb();

    await removeOperations(asDatabase, ['op-1', 'op-2']);

    expect(calls[0].sql).toContain('DELETE FROM sync_queue');
    expect(calls[0].params).toEqual(['op-1', 'op-2']);
  });

  it('una operación rechazada deja de ser pendiente pero se conserva con su motivo', async () => {
    const { asDatabase, calls } = fakeDb();

    await markFailed(asDatabase, ['op-1'], 'El formulario no cumple el schema.');

    expect(calls[0].sql).toContain("status = 'failed'");
    expect(calls[0].sql).not.toContain('DELETE');
    expect(calls[0].params[0]).toBe('El formulario no cumple el schema.');
  });

  it('soltar la clave de lote deja la operación lista para salir en una nueva', async () => {
    const { asDatabase, calls } = fakeDb();

    await clearBatchKey(asDatabase, ['op-1']);

    expect(calls[0].sql).toContain('batch_key = NULL');
    expect(calls[0].sql).not.toContain('attempts');
  });
});

describe('countPendingOperations', () => {
  it('cuenta sólo las pendientes', async () => {
    const { asDatabase, db } = fakeDb([row()]);

    expect(await countPendingOperations(asDatabase)).toBe(1);
    expect(db.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"));
  });
});
