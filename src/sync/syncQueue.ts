import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { FormSubmission } from '@/api/sync';

/** Estado de una operación en la cola. */
export type QueueStatus = 'pending' | 'failed';

/** Fila cruda de `sync_queue`. */
export interface QueueRow {
  client_operation_id: string;
  type: string;
  visit_id: string;
  payload_json: string;
  status: QueueStatus;
  attempts: number;
  batch_key: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Operación encolada, ya interpretada. */
export interface QueuedOperation {
  clientOperationId: string;
  visitId: string;
  form: FormSubmission;
  attempts: number;
  batchKey: string | null;
}

/** Cuántas operaciones entran como mucho en un lote. El backend rechaza más de 100. */
export const MAX_BATCH_SIZE = 50;

function toQueuedOperation(row: QueueRow): QueuedOperation {
  return {
    clientOperationId: row.client_operation_id,
    visitId: row.visit_id,
    form: JSON.parse(row.payload_json) as FormSubmission,
    attempts: row.attempts,
    batchKey: row.batch_key,
  };
}

/**
 * Encola el formulario de una visita para enviarlo cuando haya conexión.
 *
 * Devuelve el identificador de la operación, que es el mismo que viajará al backend en todos los
 * intentos. Ese identificador es lo único que impide que un reintento duplique el acta, así que se
 * genera **una sola vez**, acá, y no al despachar.
 */
export async function enqueueVisitForm(
  db: SQLiteDatabase,
  visitId: string,
  form: FormSubmission,
): Promise<string> {
  const clientOperationId = randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue
       (client_operation_id, type, visit_id, payload_json, status, attempts, batch_key,
        last_error, created_at, updated_at)
     VALUES (?, 'VISIT_FORM', ?, ?, 'pending', 0, NULL, NULL, ?, ?)`,
    [clientOperationId, visitId, JSON.stringify(form), now, now],
  );

  return clientOperationId;
}

/** Cuántas operaciones esperan ser enviadas. Es el número que ve el operador. */
export async function countPendingOperations(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT count(*) AS total FROM sync_queue WHERE status = 'pending'",
  );
  return row?.total ?? 0;
}

/** Operaciones que el servidor rechazó y que nadie va a reintentar solo. */
export async function countFailedOperations(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT count(*) AS total FROM sync_queue WHERE status = 'failed'",
  );
  return row?.total ?? 0;
}

/**
 * El próximo lote a enviar.
 *
 * Si quedaron operaciones con una clave de lote asignada, **ese** es el lote: son las de un envío
 * que no se pudo confirmar, y hay que reintentarlas juntas y con su misma clave. Mezclarlas con
 * operaciones nuevas cambiaría el cuerpo, y el backend rechazaría la clave por reutilizada.
 *
 * Recién cuando no queda nada a medio enviar se arma un lote nuevo con las operaciones sin clave.
 */
export async function nextBatch(db: SQLiteDatabase): Promise<QueuedOperation[]> {
  const enVuelo = await db.getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue
      WHERE status = 'pending' AND batch_key IS NOT NULL
      ORDER BY created_at ASC`,
  );

  if (enVuelo.length > 0) {
    const primera = enVuelo[0].batch_key;
    return enVuelo.filter((row) => row.batch_key === primera).map(toQueuedOperation);
  }

  const nuevas = await db.getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue
      WHERE status = 'pending' AND batch_key IS NULL
      ORDER BY created_at ASC
      LIMIT ?`,
    [MAX_BATCH_SIZE],
  );
  return nuevas.map(toQueuedOperation);
}

/**
 * Marca las operaciones como salidas en un lote, antes de mandarlo.
 *
 * El orden importa: si la clave se guardara después de enviar, un corte de red justo en el medio
 * dejaría las operaciones sin clave y el reintento saldría como un envío nuevo. Toda la protección
 * de lote depende de que esto pase primero.
 */
export async function assignBatchKey(
  db: SQLiteDatabase,
  clientOperationIds: string[],
  batchKey: string,
): Promise<void> {
  if (clientOperationIds.length === 0) {
    return;
  }
  const placeholders = clientOperationIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE sync_queue
        SET batch_key = ?, attempts = attempts + 1, updated_at = ?
      WHERE client_operation_id IN (${placeholders})`,
    [batchKey, new Date().toISOString(), ...clientOperationIds],
  );
}

/** Suelta la clave de lote: el próximo intento de estas operaciones sale con una clave nueva. */
export async function clearBatchKey(
  db: SQLiteDatabase,
  clientOperationIds: string[],
): Promise<void> {
  if (clientOperationIds.length === 0) {
    return;
  }
  const placeholders = clientOperationIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE sync_queue SET batch_key = NULL, updated_at = ?
      WHERE client_operation_id IN (${placeholders})`,
    [new Date().toISOString(), ...clientOperationIds],
  );
}

/**
 * Saca de la cola las operaciones que el servidor dio por cerradas.
 *
 * Se borran tanto las que se aplicaron ahora como las que ya estaban aplicadas de antes: para el
 * operador las dos significan lo mismo, que el acta llegó.
 */
export async function removeOperations(
  db: SQLiteDatabase,
  clientOperationIds: string[],
): Promise<void> {
  if (clientOperationIds.length === 0) {
    return;
  }
  const placeholders = clientOperationIds.map(() => '?').join(', ');
  await db.runAsync(
    `DELETE FROM sync_queue WHERE client_operation_id IN (${placeholders})`,
    clientOperationIds,
  );
}

/**
 * Marca una operación como rechazada.
 *
 * Deja de contar como pendiente y no se vuelve a intentar sola: el servidor dijo que el dato está
 * mal, y mandarlo otra vez va a fallar igual. Queda guardada, con su motivo, porque es trabajo del
 * operador y perderlo en silencio sería peor que mostrarlo sin resolver.
 */
export async function markFailed(
  db: SQLiteDatabase,
  clientOperationIds: string[],
  reason: string,
): Promise<void> {
  if (clientOperationIds.length === 0) {
    return;
  }
  const placeholders = clientOperationIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE sync_queue
        SET status = 'failed', last_error = ?, batch_key = NULL, updated_at = ?
      WHERE client_operation_id IN (${placeholders})`,
    [reason, new Date().toISOString(), ...clientOperationIds],
  );
}

/** Las operaciones rechazadas, para poder mostrarlas o reintentarlas a mano. */
export async function listFailed(db: SQLiteDatabase): Promise<QueueRow[]> {
  return db.getAllAsync<QueueRow>(
    "SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY created_at ASC",
  );
}
