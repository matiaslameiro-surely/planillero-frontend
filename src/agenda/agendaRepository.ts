import type { SQLiteDatabase } from 'expo-sqlite';

import type { RouteSheet, StartVisitResponse, VisitStatus, VisitUrgency } from '@/api/visits';

/** Evidencia del inicio de una visita hecha desde este dispositivo. */
export interface StartInfo {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  /** Hora del servidor al recibir el inicio, ISO-8601. */
  startedAt: string;
}

/** Visita de la agenda tal como la lee la pantalla desde SQLite. */
export interface AgendaVisit {
  visitId: string;
  routeDate: string;
  position: number;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  urgency: VisitUrgency;
  /** `null` si la visita no se inició desde este dispositivo, aunque figure en curso. */
  start: StartInfo | null;
}

/** Fila cruda de `agenda_visits`. */
export interface AgendaRow {
  route_date: string;
  visit_id: string;
  position: number;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  urgency: VisitUrgency;
  start_latitude: number | null;
  start_longitude: number | null;
  start_accuracy_meters: number | null;
  started_at_server: string | null;
}

/** Traduce una fila de SQLite al modelo que usa la pantalla. */
export function toAgendaVisit(row: AgendaRow): AgendaVisit {
  const hasStart =
    row.start_latitude !== null &&
    row.start_longitude !== null &&
    row.start_accuracy_meters !== null &&
    row.started_at_server !== null;

  return {
    visitId: row.visit_id,
    routeDate: row.route_date,
    position: row.position,
    code: row.code,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    urgency: row.urgency,
    start: hasStart
      ? {
          latitude: row.start_latitude!,
          longitude: row.start_longitude!,
          accuracyMeters: row.start_accuracy_meters!,
          startedAt: row.started_at_server!,
        }
      : null,
  };
}

/**
 * Vuelca la agenda de un día en SQLite, en una sola transacción.
 *
 * Es un upsert más un borrado de lo que ya no figura, no un "borrar todo y reinsertar": así una visita
 * que el supervisor reasignó a otro operador desaparece, pero las que siguen conservan la evidencia
 * de inicio guardada acá (el backend no la devuelve en la agenda).
 *
 * Si algo falla a mitad de camino la transacción se revierte y queda la copia anterior intacta.
 */
export async function replaceDay(
  db: SQLiteDatabase,
  sheet: RouteSheet,
  syncedAt: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const { position, visit } of sheet.items) {
      await db.runAsync(
        `INSERT INTO agenda_visits
           (route_date, visit_id, position, code, address, latitude, longitude, status, urgency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (route_date, visit_id) DO UPDATE SET
           position = excluded.position,
           code = excluded.code,
           address = excluded.address,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           status = excluded.status,
           urgency = excluded.urgency`,
        [
          sheet.date,
          visit.id,
          position,
          visit.code,
          visit.address,
          visit.latitude,
          visit.longitude,
          visit.status,
          visit.urgency,
        ],
      );
    }

    const ids = sheet.items.map((item) => item.visit.id);
    if (ids.length === 0) {
      await db.runAsync('DELETE FROM agenda_visits WHERE route_date = ?', [sheet.date]);
    } else {
      const placeholders = ids.map(() => '?').join(', ');
      await db.runAsync(
        `DELETE FROM agenda_visits WHERE route_date = ? AND visit_id NOT IN (${placeholders})`,
        [sheet.date, ...ids],
      );
    }

    await db.runAsync(
      `INSERT INTO agenda_sync (route_date, synced_at) VALUES (?, ?)
       ON CONFLICT (route_date) DO UPDATE SET synced_at = excluded.synced_at`,
      [sheet.date, syncedAt],
    );
  });
}

/** Visitas de un día, en el orden del recorrido. */
export async function listDay(db: SQLiteDatabase, date: string): Promise<AgendaVisit[]> {
  const rows = await db.getAllAsync<AgendaRow>(
    'SELECT * FROM agenda_visits WHERE route_date = ? ORDER BY position ASC',
    [date],
  );
  return rows.map(toAgendaVisit);
}

/** Cuántas visitas del día todavía no se iniciaron. */
export async function countPending(db: SQLiteDatabase, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM agenda_visits WHERE route_date = ? AND status = 'ASSIGNED'",
    [date],
  );
  return row?.total ?? 0;
}

/** Cuándo se bajó por última vez la agenda del día, o `null` si nunca se sincronizó. */
export async function lastSync(db: SQLiteDatabase, date: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ synced_at: string }>(
    'SELECT synced_at FROM agenda_sync WHERE route_date = ?',
    [date],
  );
  return row?.synced_at ?? null;
}

/**
 * Marca una visita como iniciada con la evidencia que confirmó el servidor.
 *
 * Se actualiza por `visit_id` en todas las fechas: el estado de una visita es único, aunque figure en
 * más de una hoja de ruta.
 */
export async function markStarted(db: SQLiteDatabase, response: StartVisitResponse): Promise<void> {
  await db.runAsync(
    `UPDATE agenda_visits
        SET status = 'IN_PROGRESS',
            start_latitude = ?,
            start_longitude = ?,
            start_accuracy_meters = ?,
            started_at_server = ?
      WHERE visit_id = ?`,
    [
      response.latitude,
      response.longitude,
      response.accuracyMeters,
      response.startedAtServer,
      response.visitId,
    ],
  );
}
