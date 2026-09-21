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
    // Cola de sincronización: lo que el operador cargó sin conexión y todavía no llegó al servidor.
    //
    // Vive en este mismo archivo cifrado y no en una base aparte: son actas de un expediente y
    // merecen el mismo resguardo que el resto. Una segunda base serían dos claves y dos ciclos de
    // vida sin ganar nada.
    //
    // Sólo quedan acá las operaciones que faltan resolver: al confirmarse, se borran. Así "cuántas
    // hay pendientes" es contar filas y no puede desincronizarse de la realidad.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        -- Identificador de la operación, generado en el dispositivo. Viaja al backend y es lo que
        -- hace que un reintento no duplique el acta.
        client_operation_id TEXT    PRIMARY KEY NOT NULL,
        type                TEXT    NOT NULL,
        visit_id            TEXT    NOT NULL,
        -- El cuerpo del formulario tal cual se va a enviar, ya serializado.
        payload_json        TEXT    NOT NULL,
        -- 'pending': falta enviarla. 'failed': el servidor la rechazó por el dato; no se reintenta sola.
        status              TEXT    NOT NULL,
        attempts            INTEGER NOT NULL DEFAULT 0,
        -- Clave del lote en el que salió. Se asigna ANTES de enviar: si se corta la red, el
        -- reintento usa la misma y el backend lo reconoce como el mismo envío.
        batch_key           TEXT,
        last_error          TEXT,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status, created_at);

      PRAGMA user_version = 2;
    `);
  }
}
