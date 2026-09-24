import type { SQLiteDatabase } from 'expo-sqlite';

import { AGENDA_SCHEMA_VERSION, ensureAgendaSchema } from '@/db/agendaSchema';

/**
 * Tests unitarios de migración del esquema de la agenda local.
 *
 * Se verifica que la migración incremental funcione desde cualquier versión previa
 * (0, 1, 2, 3) hasta la versión actual (4) sin sentencias duplicadas, y que una base
 * ya actualizada no ejecute pasos adicionales.
 */

function fakeDatabase(userVersion: number) {
  const executedStatements: string[] = [];
  const db = {
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: userVersion }),
    execAsync: jest.fn().mockImplementation(async (sql: string) => {
      executedStatements.push(sql);
    }),
  };
  return {
    db: db as unknown as SQLiteDatabase,
    execAsyncMock: db.execAsync,
    getFirstAsyncMock: db.getFirstAsync,
    executedStatements,
  };
}

describe('agendaSchema', () => {
  it('define la versión actual del esquema como 4', () => {
    expect(AGENDA_SCHEMA_VERSION).toBe(4);
  });

  it('migra una base limpia desde la versión 0 hasta la versión 4 ejecutando los 4 pasos', async () => {
    const { db, execAsyncMock, executedStatements } = fakeDatabase(0);

    await ensureAgendaSchema(db);

    expect(execAsyncMock).toHaveBeenCalledTimes(4);

    // Paso 1: crea tablas base y define user_version = 1
    expect(executedStatements[0]).toContain('CREATE TABLE IF NOT EXISTS agenda_visits');
    expect(executedStatements[0]).toContain('CREATE TABLE IF NOT EXISTS agenda_sync');
    expect(executedStatements[0]).toContain('PRAGMA user_version = 1;');

    // Paso 2: crea visit_audit_traces y define user_version = 2 sin ALTER TABLE sobre agenda_visits
    expect(executedStatements[1]).toContain('CREATE TABLE IF NOT EXISTS visit_audit_traces');
    expect(executedStatements[1]).toContain('PRAGMA user_version = 2;');
    expect(executedStatements[1]).not.toContain('ALTER TABLE agenda_visits');

    // Paso 3: crea sync_queue y define user_version = 3
    expect(executedStatements[2]).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
    expect(executedStatements[2]).toContain('PRAGMA user_version = 3;');

    // Paso 4: agrega columnas de formulario y define user_version = 4
    expect(executedStatements[3]).toContain('ALTER TABLE agenda_visits ADD COLUMN form_template_id TEXT;');
    expect(executedStatements[3]).toContain('ALTER TABLE agenda_visits ADD COLUMN form_template_version INTEGER;');
    expect(executedStatements[3]).toContain('ALTER TABLE agenda_visits ADD COLUMN form_submitted_at TEXT;');
    expect(executedStatements[3]).toContain('PRAGMA user_version = 4;');
  });

  it('migra incrementalmente desde versión 1 ejecutando pasos 2, 3 y 4', async () => {
    const { db, execAsyncMock, executedStatements } = fakeDatabase(1);

    await ensureAgendaSchema(db);

    expect(execAsyncMock).toHaveBeenCalledTimes(3);
    expect(executedStatements[0]).toContain('PRAGMA user_version = 2;');
    expect(executedStatements[0]).not.toContain('ALTER TABLE agenda_visits');
    expect(executedStatements[1]).toContain('PRAGMA user_version = 3;');
    expect(executedStatements[2]).toContain('PRAGMA user_version = 4;');
  });

  it('migra incrementalmente desde versión 2 ejecutando pasos 3 y 4', async () => {
    const { db, execAsyncMock, executedStatements } = fakeDatabase(2);

    await ensureAgendaSchema(db);

    expect(execAsyncMock).toHaveBeenCalledTimes(2);
    expect(executedStatements[0]).toContain('PRAGMA user_version = 3;');
    expect(executedStatements[1]).toContain('PRAGMA user_version = 4;');
  });

  it('migra incrementalmente desde versión 3 ejecutando sólo el paso 4', async () => {
    const { db, execAsyncMock, executedStatements } = fakeDatabase(3);

    await ensureAgendaSchema(db);

    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    expect(executedStatements[0]).toContain('ALTER TABLE agenda_visits ADD COLUMN form_template_id TEXT;');
    expect(executedStatements[0]).toContain('PRAGMA user_version = 4;');
  });

  it('no ejecuta ninguna migración si la base ya está en la versión 4', async () => {
    const { db, execAsyncMock } = fakeDatabase(4);

    await ensureAgendaSchema(db);

    expect(execAsyncMock).not.toHaveBeenCalled();
  });
});
