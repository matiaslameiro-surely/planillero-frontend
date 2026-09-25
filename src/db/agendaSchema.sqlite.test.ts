import type { SQLiteDatabase } from 'expo-sqlite';
import type { DatabaseSync } from 'node:sqlite';

import { ensureAgendaSchema } from '@/db/agendaSchema';

/**
 * Tests de integración de la migración de la agenda contra SQLite real (PLAN-52).
 *
 * Los tests unitarios de `agendaSchema.test.ts` usan un doble con columnas fijas: prueban qué SQL se
 * arma, pero no que SQLite lo acepte. Acá el mismo `ensureAgendaSchema` corre sobre una base en
 * memoria de `node:sqlite`, con los estados que dejaron las versiones publicadas en los dispositivos.
 *
 * `node:sqlite` viene con Node desde la 22.13, y todo el rango de `engines` en `package.json` lo
 * incluye. Con un Node sin ese módulo la suite falla con un mensaje que lo dice: saltearla dejaría
 * sin probar contra SQLite real justo el caso que originó el bug, sin que nadie se entere.
 */

type NodeSqlite = typeof import('node:sqlite');

function loadNodeSqlite(): NodeSqlite {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:sqlite') as NodeSqlite;
  } catch (error) {
    throw new Error(
      `Estos tests necesitan node:sqlite, que no está en Node ${process.versions.node}. Usá un Node del rango de engines en package.json.`,
      { cause: error },
    );
  }
}

const nodeSqlite = loadNodeSqlite();

/** Adapta una base de `node:sqlite` a la parte de `SQLiteDatabase` que usa la migración. */
function asExpoDatabase(db: DatabaseSync): SQLiteDatabase {
  const adapter = {
    getFirstAsync: async (sql: string) => db.prepare(sql).get() ?? null,
    getAllAsync: async (sql: string) => db.prepare(sql).all(),
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

function openMemoryDatabase(): DatabaseSync {
  return new nodeSqlite.DatabaseSync(':memory:');
}

function userVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function agendaColumns(db: DatabaseSync): string[] {
  return (db.prepare('PRAGMA table_info(agenda_visits)').all() as { name: string }[]).map((column) => column.name);
}

/** Tabla `agenda_visits` tal como la crea el paso 1, más las columnas de formulario indicadas. */
function createAgendaVisits(db: DatabaseSync, formColumns: string[]): void {
  const extra = formColumns.map((column) => `, ${column} ${column === 'form_template_version' ? 'INTEGER' : 'TEXT'}`);
  db.exec(`
    CREATE TABLE agenda_visits (
      route_date            TEXT    NOT NULL,
      visit_id              TEXT    NOT NULL,
      position              INTEGER NOT NULL,
      code                  TEXT    NOT NULL,
      address               TEXT    NOT NULL,
      latitude              REAL    NOT NULL,
      longitude             REAL    NOT NULL,
      status                TEXT    NOT NULL,
      urgency               TEXT    NOT NULL,
      start_latitude        REAL,
      start_longitude       REAL,
      start_accuracy_meters REAL,
      started_at_server     TEXT
      ${extra.join('')},
      PRIMARY KEY (route_date, visit_id)
    );
    INSERT INTO agenda_visits
      (route_date, visit_id, position, code, address, latitude, longitude, status, urgency)
    VALUES
      ('2026-11-01', 'visit-1', 1, 'V-0001', 'Calle Ficticia 123', -34.6, -58.4, 'PENDING', 'NORMAL');
  `);
}

const FORM_COLUMNS = ['form_template_id', 'form_template_version', 'form_submitted_at'];

describe('agendaSchema contra SQLite real', () => {
  it('migra una base nueva hasta la versión 4 con las columnas de formulario', async () => {
    const db = openMemoryDatabase();

    await ensureAgendaSchema(asExpoDatabase(db));

    expect(userVersion(db)).toBe(4);
    expect(agendaColumns(db)).toEqual(expect.arrayContaining(FORM_COLUMNS));
  });

  it.each([
    { from: 2, present: FORM_COLUMNS },
    { from: 3, present: FORM_COLUMNS },
    { from: 2, present: ['form_template_id'] },
    { from: 3, present: ['form_template_id', 'form_submitted_at'] },
    { from: 3, present: [] },
  ])('desde la versión $from con $present llega a la versión 4 sin error', async ({ from, present }) => {
    const db = openMemoryDatabase();
    createAgendaVisits(db, present);
    db.exec(`PRAGMA user_version = ${from};`);

    await ensureAgendaSchema(asExpoDatabase(db));

    expect(userVersion(db)).toBe(4);
    const columns = agendaColumns(db);
    for (const column of FORM_COLUMNS) {
      expect(columns.filter((name) => name === column)).toHaveLength(1);
    }
    // La migración agrega columnas: las filas que ya estaban se conservan.
    expect(db.prepare('SELECT code FROM agenda_visits').all()).toEqual([{ code: 'V-0001' }]);
  });

  it('es idempotente: volver a correrla sobre una base en versión 4 no falla ni cambia nada', async () => {
    const db = openMemoryDatabase();
    await ensureAgendaSchema(asExpoDatabase(db));
    const columnsBefore = agendaColumns(db);

    await ensureAgendaSchema(asExpoDatabase(db));

    expect(userVersion(db)).toBe(4);
    expect(agendaColumns(db)).toEqual(columnsBefore);
  });
});
