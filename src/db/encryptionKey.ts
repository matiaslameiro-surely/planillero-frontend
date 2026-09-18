import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/** Bytes de la clave: 256 bits, el tamaño que usa SQLCipher. */
const KEY_BYTES = 32;

/** Forma esperada de una clave guardada: 64 caracteres hexadecimales. */
const KEY_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Convierte un identificador de operador en algo apto para nombres de clave y de archivo.
 *
 * `expo-secure-store` sólo admite letras, números, `.`, `-` y `_` en sus claves, y un nombre de
 * usuario puede traer otros caracteres. La codificación en hexadecimal es reversible, así que dos
 * operadores distintos nunca comparten clave ni archivo.
 */
export function ownerSlug(ownerId: string): string {
  return Array.from(ownerId)
    .map((char) => char.codePointAt(0)!.toString(16).padStart(4, '0'))
    .join('');
}

function storageKey(ownerId: string): string {
  return `planillero.db.key.${ownerSlug(ownerId)}`;
}

function generateKey(): string {
  return Array.from(getRandomBytes(KEY_BYTES), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Devuelve la clave de cifrado de la base local del operador, y la genera la primera vez.
 *
 * La clave es aleatoria y vive sólo en el almacén seguro del dispositivo (Keychain/Keystore): no se
 * deriva de la contraseña ni de la sesión, porque la sesión se renueva y la contraseña no se
 * conserva, y cualquiera de las dos dejaría la base ilegible al volver a iniciar sesión.
 *
 * A diferencia de los tokens, **no hay respaldo en memoria**: una clave que no se puede resguardar
 * dejaría datos cifrados que nadie podría abrir después. Si el almacén seguro falla, se propaga el
 * error.
 */
export async function getOrCreateEncryptionKey(ownerId: string): Promise<string> {
  const name = storageKey(ownerId);

  const stored = await SecureStore.getItemAsync(name);
  if (stored !== null) {
    if (!KEY_PATTERN.test(stored)) {
      throw new Error('La clave de cifrado guardada está dañada.');
    }
    return stored;
  }

  const key = generateKey();
  await SecureStore.setItemAsync(name, key);
  return key;
}

/** Borra la clave del operador. Sin ella, su base local cifrada queda inutilizable. */
export async function deleteEncryptionKey(ownerId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(ownerId));
}
