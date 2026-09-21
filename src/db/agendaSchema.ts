import type { SQLiteDatabase } from 'expo-sqlite';

/** Versión actual del esquema local. Sube cuando se agrega un paso de migración. */
export const AGENDA_SCHEMA_VERSION = 2;

/**
 * Crea o migra las tablas locales de la agenda.
 *
 * La versión vive en `PRAGMA user_version`, que SQLite guarda dentro del propio archivo cifrado, así
 * que un archivo nuevo arranca en 0 y uno ya migrado no repite pasos. Cada paso de migración se
 * agrega como un bloque `if (version < N)` que termina subiendo la versión.
 */
export async function ensureAgendaSchema(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS agenda_visits (
        route_date            TEXT    NOT NULL,
        visit_id              TEXT    NOT NULL,
        position              INTEGER NOT NULL,
        code                  TEXT    NOT NULL,
        address               TEXT    NOT NULL,
        latitude              REAL    NOT NULL,
        longitude             REAL    NOT NULL,
        status                TEXT    NOT NULL,
        urgency               TEXT    NOT NULL,
        -- Evidencia del inicio, sólo si la visita se inició desde este dispositivo.
        start_latitude        REAL,
        start_longitude       REAL,
        start_accuracy_meters REAL,
        started_at_server     TEXT,
        PRIMARY KEY (route_date, visit_id)
      );
      CREATE INDEX IF NOT EXISTS idx_agenda_visits_visit ON agenda_visits (visit_id);

      -- Cuándo se bajó por última vez la agenda de cada día.
      CREATE TABLE IF NOT EXISTS agenda_sync (
        route_date TEXT PRIMARY KEY NOT NULL,
        synced_at  TEXT NOT NULL
      );

      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      -- Trazas locales de eventos operativos (PLAN-11 / TASK-12), para viajar en el batch de
      -- sincronización cuando exista el motor de TASK-09. Hasta entonces, sólo se acumulan acá.
      CREATE TABLE IF NOT EXISTS visit_audit_traces (
        id          TEXT NOT NULL PRIMARY KEY,
        visit_id    TEXT NOT NULL,
        event_type  TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        metadata    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_visit_audit_traces_visit ON visit_audit_traces (visit_id);

      PRAGMA user_version = 2;
    `);
  }
}
