import type { SQLiteDatabase } from 'expo-sqlite';

/** Versión actual del esquema local. Sube cuando se agrega un paso de migración. */
export const AGENDA_SCHEMA_VERSION = 4;

/** Columnas de formulario que agrega el paso 4 sobre `agenda_visits`. */
const FORM_COLUMNS = [
  { name: 'form_template_id', type: 'TEXT' },
  { name: 'form_template_version', type: 'INTEGER' },
  { name: 'form_submitted_at', type: 'TEXT' },
] as const;

/**
 * Crea o migra las tablas locales de la agenda.
 *
 * La versión vive en `PRAGMA user_version`, que SQLite guarda dentro del propio archivo cifrado, así
 * que un archivo nuevo arranca en 0 y uno ya migrado no repite pasos. Cada paso de migración se
 * agrega como un bloque `if (version < N)` que termina subiendo la versión.
 *
 * Un paso ya publicado **no se edita ni se renumera**: hay dispositivos con esa versión aplicada, y
 * lo que no vuelve a ejecutarse en ellos es lo que ya corrió. Todo lo nuevo entra como un paso más.
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

  if (version < 3) {
    // Cola de sincronización: lo que el operador cargó sin conexión y todavía no llegó al servidor.
    //
    // Vive en este mismo archivo cifrado y no en una base aparte: son actas de un expediente y
    // merecen el mismo resguardo que el resto. Una segunda base serían dos claves y dos ciclos de
    // vida sin ganar nada.
    //
    // Sólo quedan acá las operaciones que faltan resolver: al confirmarse, se borran. Así "cuántas
    // hay pendientes" es contar filas y no puede desincronizarse de la realidad.
    //
    // Es el paso 3 y no el 2 porque PLAN-11 publicó el 2 antes: en un dispositivo que ya migró, un
    // paso 2 reescrito no se volvería a ejecutar y esta tabla no existiría nunca.
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

      PRAGMA user_version = 3;
    `);
  }

  if (version < 4) {
    // Columnas de formulario para el renderizador dinámico (PLAN-13), que la tabla del paso 1 no
    // tiene.
    //
    // Sólo se agregan las que faltan: el paso 2 publicado antes de PLAN-47 ya las agregaba, así que
    // hay dispositivos en v2 o v3 que las tienen y un `ADD COLUMN` fijo los traba con
    // «duplicate column name». Es la excepción a no editar un paso publicado: donde ya corrió no se
    // repite, y donde no corrió es justamente el que falla (PLAN-52).
    const existing = await db.getAllAsync<{ name: string }>('PRAGMA table_info(agenda_visits)');
    const existingNames = new Set(existing.map((column) => column.name));
    const additions = FORM_COLUMNS.filter((column) => !existingNames.has(column.name))
      .map((column) => `ALTER TABLE agenda_visits ADD COLUMN ${column.name} ${column.type};`)
      .join('\n');

    await db.execAsync(`
      ${additions}

      PRAGMA user_version = 4;
    `);
  }
}
