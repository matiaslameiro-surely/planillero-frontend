import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { startVisit as postStartVisit, type StartVisitResponse } from '@/api/visits';
import { markStarted } from '@/agenda/agendaRepository';
import { insertTrace } from '@/audit/auditRepository';
import { captureLocation, LocationError, type LocationErrorCode } from '@/visit/location';

/** Por qué no se pudo iniciar la visita. */
export type StartFailure = LocationErrorCode | 'offline' | 'not_assigned' | 'server';

/** Resultado de intentar iniciar una visita. Nunca se lanza: la pantalla decide qué mostrar. */
export type StartOutcome =
  | { kind: 'started'; response: StartVisitResponse }
  /** El backend dijo que ya estaba iniciada: hay que refrescar la agenda, no es un error. */
  | { kind: 'alreadyStarted' }
  | { kind: 'failed'; reason: StartFailure; message: string };

const MESSAGES: Record<StartFailure, string> = {
  permission_denied: 'Falta el permiso de ubicación. Activalo en los ajustes del dispositivo.',
  services_disabled: 'El GPS está apagado. Encendelo para iniciar la visita.',
  mock_location: 'Se detectó una ubicación simulada. No se puede iniciar la visita.',
  no_fix: 'No se pudo obtener tu ubicación. Probá en un lugar abierto.',
  offline: 'No hay conexión con el servidor. Reintentá cuando vuelva.',
  not_assigned: 'Esta visita ya no está asignada a vos. Actualizá la agenda.',
  server: 'El servidor no pudo registrar el inicio. Reintentá en un momento.',
};

function failed(reason: StartFailure): StartOutcome {
  return { kind: 'failed', reason, message: MESSAGES[reason] };
}

/**
 * Inicia una visita: captura la ubicación, la envía al backend y refleja el resultado en SQLite.
 *
 * El orden importa: primero se captura (si el GPS o el permiso fallan, no se toca la red), después se
 * confía en el servidor y sólo con su respuesta se cambia la copia local. Ante cualquier error la
 * base local queda exactamente como estaba.
 *
 * Si el servidor registró el inicio pero falla la escritura local, igual se informa como iniciada: la
 * próxima sincronización trae el estado real del servidor y repara la copia.
 */
export async function startVisit(db: SQLiteDatabase, visitId: string): Promise<StartOutcome> {
  let location;
  try {
    location = await captureLocation();
  } catch (error) {
    if (error instanceof LocationError) {
      return failed(error.code);
    }
    return failed('no_fix');
  }

  let response: StartVisitResponse;
  try {
    response = await postStartVisit(visitId, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
      clientTimestamp: new Date(location.capturedAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return { kind: 'alreadyStarted' };
      }
      if (error.status === 403 || error.status === 404) {
        return failed('not_assigned');
      }
      return failed('server');
    }
    // Un fallo de red llega como TypeError de fetch (o como un aborto por tiempo de espera).
    return failed('offline');
  }

  try {
    await markStarted(db, response);
  } catch {
    // Ver la nota de arriba: la próxima sincronización repara la copia local.
  }
  try {
    await insertTrace(db, response.visitId, 'VISIT_STARTED', {
      latitude: response.latitude,
      longitude: response.longitude,
      accuracyMeters: response.accuracyMeters,
    });
  } catch {
    // La traza es un registro local best-effort: no bloquea el flujo de la visita.
  }
  return { kind: 'started', response };
}
