import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { postSyncBatch, type SyncOperation } from '@/api/sync';
import {
  assignBatchKey,
  clearBatchKey,
  countPendingOperations,
  markFailed,
  nextBatch,
  removeOperations,
} from '@/sync/syncQueue';

/**
 * Cuántas veces se manda un lote que el servidor rechaza antes de darlo por perdido.
 *
 * Cuenta los rechazos **del servidor**, no los cortes de red. Quedarse sin señal no es culpa del
 * dato: si lo fuera, un operador con una jornada entera sin cobertura vería su trabajo marcado como
 * fallido sin que nada estuviera mal.
 */
export const MAX_ATTEMPTS = 5;

/** Qué pasó en un despacho. */
export interface DispatchResult {
  /** Operaciones que iban en el lote. `0` si no había nada para enviar. */
  sent: number;
  /** Operaciones que el servidor dio por cerradas y salieron de la cola. */
  settled: number;
  /** Operaciones que el servidor rechazó por el dato. */
  rejected: number;
  /** Cuántas siguen esperando después de este intento. */
  pending: number;
  /** Por qué no se pudo completar, si no se pudo. */
  failure: 'offline' | 'busy' | 'unauthorized' | null;
}

/**
 * Vacía la cola: arma un lote, lo manda y aplica lo que el servidor conteste.
 *
 * Sin conexión no hace nada y deja la cola intacta — que es exactamente lo que tiene que pasar. Con
 * conexión, cada operación termina resuelta (sale de la cola) o rechazada (queda guardada con su
 * motivo). Nunca se pierde trabajo del operador en silencio.
 *
 * No lanza: un fallo de red es un estado esperado de una app móvil, no una excepción, y quien llama
 * es una pantalla que sólo necesita saber qué mostrar.
 */
export async function dispatchQueue(db: SQLiteDatabase): Promise<DispatchResult> {
  const batch = await nextBatch(db);
  if (batch.length === 0) {
    return { sent: 0, settled: 0, rejected: 0, pending: 0, failure: null };
  }

  const ids = batch.map((operation) => operation.clientOperationId);

  // Un lote que ya agotó los intentos no se manda más: se archiva con su motivo. Si no, cada vez que
  // volviera la señal se reintentaría lo mismo para recibir el mismo rechazo.
  if (batch.some((operation) => operation.attempts >= MAX_ATTEMPTS)) {
    await markFailed(db, ids, `El servidor rechazó el envío ${MAX_ATTEMPTS} veces.`);
    return {
      sent: 0,
      settled: 0,
      rejected: ids.length,
      pending: await countPendingOperations(db),
      failure: null,
    };
  }

  // La clave se reutiliza si el lote ya salió una vez: para el backend tiene que ser el mismo envío,
  // no uno nuevo. Y se guarda ANTES de mandar, porque el corte puede ocurrir en el medio.
  const batchKey = batch[0].batchKey ?? randomUUID();
  await assignBatchKey(db, ids, batchKey);

  const operations: SyncOperation[] = batch.map((operation) => ({
    clientOperationId: operation.clientOperationId,
    type: 'VISIT_FORM',
    visitId: operation.visitId,
    form: operation.form,
  }));

  let results;
  try {
    results = (await postSyncBatch(batchKey, operations)).results;
  } catch (error) {
    return { ...(await onFailure(db, ids, error)), sent: batch.length };
  }

  // `DUPLICATE` sale de la cola igual que `APPLIED`: el acta está en el servidor, que es lo único
  // que le importa al operador.
  const cerradas = results
    .filter((result) => result.status !== 'FAILED')
    .map((result) => result.clientOperationId);
  const rechazadas = results.filter((result) => result.status === 'FAILED');

  await removeOperations(db, cerradas);
  for (const rechazada of rechazadas) {
    await markFailed(
      db,
      [rechazada.clientOperationId],
      rechazada.message ?? rechazada.error ?? 'El servidor rechazó la operación.',
    );
  }

  return {
    sent: batch.length,
    settled: cerradas.length,
    rejected: rechazadas.length,
    pending: await countPendingOperations(db),
    failure: null,
  };
}

/** Traduce el fallo de un envío a lo que hay que dejar guardado en la cola. */
async function onFailure(
  db: SQLiteDatabase,
  ids: string[],
  error: unknown,
): Promise<Omit<DispatchResult, 'sent'>> {
  const pendientes = async () => countPendingOperations(db);

  if (!(error instanceof ApiError)) {
    // Fallo de red (o tiempo de espera agotado): el lote queda tal cual, con su clave, y el próximo
    // intento lo manda igual. Si el servidor llegó a recibirlo, la clave hará que no se aplique dos
    // veces — que es justamente para lo que está.
    return { settled: 0, rejected: 0, pending: await pendientes(), failure: 'offline' };
  }

  if (error.status === 409 && error.code === 'idempotency_key_in_progress') {
    // El envío anterior todavía se está procesando del otro lado. Se reintenta más tarde con la
    // misma clave.
    return { settled: 0, rejected: 0, pending: await pendientes(), failure: 'busy' };
  }

  if (error.status === 409 && error.code === 'idempotency_key_reused') {
    // La clave quedó asociada a otro cuerpo y ya no sirve. Se suelta y el próximo intento sale con
    // una nueva: lo que ya se hubiera aplicado va a volver como `DUPLICATE`, así que no hay riesgo
    // de duplicar nada.
    await clearBatchKey(db, ids);
    return { settled: 0, rejected: 0, pending: await pendientes(), failure: null };
  }

  if (error.status === 401 || error.status === 403) {
    // La sesión no alcanza. No es un problema del dato: la cola se conserva entera para cuando el
    // operador vuelva a entrar.
    await clearBatchKey(db, ids);
    return { settled: 0, rejected: 0, pending: await pendientes(), failure: 'unauthorized' };
  }

  if (error.status >= 400 && error.status < 500) {
    // El lote entero es inválido para el servidor. Reintentarlo daría siempre lo mismo.
    await markFailed(db, ids, error.message);
    return { settled: 0, rejected: ids.length, pending: await pendientes(), failure: null };
  }

  // 5xx: el servidor tuvo un problema propio. Se conserva la clave y se reintenta.
  return { settled: 0, rejected: 0, pending: await pendientes(), failure: 'offline' };
}
