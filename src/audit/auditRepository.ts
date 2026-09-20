import type { SQLiteDatabase } from 'expo-sqlite';

/** Evento operativo local, tal como se guarda en `visit_audit_traces`. */
export interface AuditTrace {
  id: string;
  visitId: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
}

/** Fila cruda de `visit_audit_traces`. */
interface AuditTraceRow {
  id: string;
  visit_id: string;
  event_type: string;
  occurred_at: string;
  metadata: string | null;
}

function toAuditTrace(row: AuditTraceRow): AuditTrace {
  return {
    id: row.id,
    visitId: row.visit_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

/**
 * Registra un evento operativo de una visita en la base local.
 *
 * No se transmite: TASK-09 (el motor de sincronización) todavía no existe. Esta tabla sólo deja el
 * dato con la forma correcta para cuando exista.
 *
 * `occurredAt` es opcional: cuando el llamador ya tiene un timestamp autoritativo (por ejemplo,
 * `startedAtServer` de la respuesta del backend al iniciar una visita), hay que pasarlo, porque el
 * reloj del dispositivo puede estar desfasado y esta traza sostiene trazabilidad legal. A falta de
 * uno, se usa la hora local del dispositivo.
 */
export async function insertTrace(
  db: SQLiteDatabase,
  visitId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
  occurredAt?: string,
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.runAsync(
    `INSERT INTO visit_audit_traces (id, visit_id, event_type, occurred_at, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      visitId,
      eventType,
      occurredAt ?? new Date().toISOString(),
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

/** Trazas locales de una visita, en el orden en que ocurrieron. */
export async function listTraces(db: SQLiteDatabase, visitId: string): Promise<AuditTrace[]> {
  const rows = await db.getAllAsync<AuditTraceRow>(
    'SELECT * FROM visit_audit_traces WHERE visit_id = ? ORDER BY occurred_at ASC',
    [visitId],
  );
  return rows.map(toAuditTrace);
}
