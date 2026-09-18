import * as SQLite from 'expo-sqlite';

import { openEncryptedDatabase } from '@/db/database';
import { getOrCreateEncryptionKey } from '@/db/encryptionKey';

/**
 * Tests de la apertura de la base cifrada.
 *
 * SQLCipher es código nativo y no corre en Jest: se reemplazan `expo-sqlite` y la gestión de la clave
 * por dobles. Lo que se verifica es el orden de las operaciones y el manejo del error. Que el archivo
 * quede realmente cifrado sólo se comprueba en un development build (ver `02-plan.md`).
 */

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

jest.mock('@/db/encryptionKey', () => ({
  getOrCreateEncryptionKey: jest.fn(),
  ownerSlug: jest.fn((id: string) => `slug-${id}`),
}));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;
const getKey = getOrCreateEncryptionKey as jest.Mock;

const KEY = 'ab'.repeat(32);

function fakeDatabase() {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue({ 'count(*)': 0 }),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  getKey.mockResolvedValue(KEY);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('openEncryptedDatabase', () => {
  it('abre el archivo del operador, aplica la clave y verifica que se pueda leer', async () => {
    const db = fakeDatabase();
    openDatabaseAsync.mockResolvedValue(db);

    await expect(openEncryptedDatabase('operator.one')).resolves.toBe(db);

    expect(openDatabaseAsync).toHaveBeenCalledWith('planillero-slug-operator.one.db');
    expect(db.execAsync).toHaveBeenCalledWith(`PRAGMA key = "x'${KEY}'";`);
    // La lectura tiene que ocurrir después de aplicar la clave.
    expect(db.execAsync.mock.invocationCallOrder[0]).toBeLessThan(
      db.getFirstAsync.mock.invocationCallOrder[0],
    );
    expect(db.closeAsync).not.toHaveBeenCalled();
  });

  it('cierra la base y falla si la clave no corresponde al archivo', async () => {
    const db = fakeDatabase();
    db.getFirstAsync.mockRejectedValue(new Error('file is not a database'));
    openDatabaseAsync.mockResolvedValue(db);

    await expect(openEncryptedDatabase('operator.one')).rejects.toThrow('base local cifrada');

    expect(db.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('no abre nada si no se puede obtener la clave', async () => {
    getKey.mockRejectedValue(new Error('almacén seguro no disponible'));

    await expect(openEncryptedDatabase('operator.one')).rejects.toThrow('almacén seguro');

    expect(openDatabaseAsync).not.toHaveBeenCalled();
  });
});
