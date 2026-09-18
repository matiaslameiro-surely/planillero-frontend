import * as SQLite from 'expo-sqlite';

import { getOrCreateEncryptionKey, ownerSlug } from '@/db/encryptionKey';

/**
 * Abre la base SQLite local del operador, cifrada con SQLCipher.
 *
 * Requiere un development build con `useSQLCipher` en `app.json`: en Expo Go la app no incluye
 * SQLCipher y el `PRAGMA key` no cifra nada. Por eso, después de aplicar la clave se lee del esquema
 * de la base, que falla si la clave no corresponde al archivo.
 *
 * Cada operador tiene su propio archivo y su propia clave: un operador nunca abre la base de otro.
 *
 * Esta función sólo abre y desbloquea. Las tablas de negocio las crea quien las necesite.
 */
export async function openEncryptedDatabase(ownerId: string): Promise<SQLite.SQLiteDatabase> {
  const key = await getOrCreateEncryptionKey(ownerId);
  const db = await SQLite.openDatabaseAsync(`planillero-${ownerSlug(ownerId)}.db`);

  try {
    // Clave cruda de 256 bits (`x'...'`): SQLCipher la usa tal cual, sin derivarla de una contraseña.
    // La clave es hexadecimal validado en `getOrCreateEncryptionKey`, así que no hay inyección posible.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
  } catch (error) {
    await db.closeAsync();
    throw new Error('No se pudo abrir la base local cifrada.', { cause: error });
  }

  return db;
}
