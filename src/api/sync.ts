import { requestWithAuth } from '@/api/client';

/**
 * Sincronización por lote de lo que se cargó sin conexión.
 *
 * Refleja `03-contrato-api.md` de PLAN-14. Los nombres y las formas son los del backend: si algo hace
 * falta y no está acá, se pide al backend en vez de inventarlo del lado del cliente.
 */

/** El formulario de una visita, con la misma forma que en la carga en línea. */
export interface FormSubmission {
  templateKey: string;
  templateVersion?: number;
  responses: Record<string, unknown>;
}

/** Una operación del lote. */
export interface SyncOperation {
  clientOperationId: string;
  type: 'VISIT_FORM';
  visitId: string;
  form: FormSubmission;
}

/**
 * Cómo terminó una operación.
 *
 * `DUPLICATE` **no es un error**: significa que ya estaba aplicada, y para la cola vale lo mismo que
 * `APPLIED`. Es el desenlace normal de un reintento después de un corte de red.
 */
export type SyncOperationStatus = 'APPLIED' | 'DUPLICATE' | 'FAILED';

export interface SyncOperationResult {
  clientOperationId: string;
  status: SyncOperationStatus;
  form: {
    visitId: string;
    templateKey: string;
    templateVersion: number;
    submittedAt: string;
  } | null;
  error: string | null;
  message: string | null;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
}

/**
 * Envía un lote al backend.
 *
 * La clave de idempotencia identifica **el envío**, no el intento: todos los reintentos del mismo
 * lote repiten la misma clave, y es lo que hace que el backend los reconozca en vez de volver a
 * aplicar las operaciones.
 */
export async function postSyncBatch(
  idempotencyKey: string,
  operations: SyncOperation[],
): Promise<SyncBatchResponse> {
  return requestWithAuth<SyncBatchResponse>('/api/v1/sync/batch', {
    method: 'POST',
    body: { operations },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
