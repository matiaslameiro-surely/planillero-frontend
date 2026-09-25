import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { completeVisit as postCompleteVisit, type CompleteVisitResponse } from '@/api/visits';
import { markCompleted } from '@/agenda/agendaRepository';
import { insertTrace } from '@/audit/auditRepository';

export type CompleteFailure = 'offline' | 'not_assigned' | 'not_in_progress' | 'server';

export type CompleteOutcome =
  | { kind: 'completed'; response: CompleteVisitResponse }
  | { kind: 'alreadyCompleted' }
  | { kind: 'failed'; reason: CompleteFailure; message: string };

const MESSAGES: Record<CompleteFailure, string> = {
  offline: 'No hay conexión con el servidor. Reintentá cuando vuelva.',
  not_assigned: 'Esta visita ya no está asignada a vos. Actualizá la agenda.',
  not_in_progress: 'La visita no se encuentra en curso para ser finalizada.',
  server: 'El servidor no pudo registrar la finalización. Reintentá en un momento.',
};

function failed(reason: CompleteFailure): CompleteOutcome {
  return { kind: 'failed', reason, message: MESSAGES[reason] };
}

/**
 * Finaliza una visita: envía la confirmación al backend, actualiza SQLite local y registra la traza pericial.
 */
export async function completeVisit(db: SQLiteDatabase, visitId: string): Promise<CompleteOutcome> {
  let response: CompleteVisitResponse;
  try {
    response = await postCompleteVisit(visitId);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        if (error.code === 'visit_already_completed') {
          try {
            await markCompleted(db, visitId);
          } catch {
            // best-effort
          }
          return { kind: 'alreadyCompleted' };
        }
        return failed('not_in_progress');
      }
      if (error.status === 403 || error.status === 404) {
        return failed('not_assigned');
      }
      return failed('server');
    }
    return failed('offline');
  }

  try {
    await markCompleted(db, response.visitId);
  } catch {
    // Si la escritura local falla, la próxima sincronización repara la copia
  }

  try {
    await insertTrace(
      db,
      response.visitId,
      'VISIT_COMPLETED',
      {
        code: response.code,
        status: response.status,
      },
      response.completedAt,
    );
  } catch {
    // Traza local best-effort
  }

  return { kind: 'completed', response };
}
