import * as SecureStore from 'expo-secure-store';

import { deleteEncryptionKey, getOrCreateEncryptionKey, ownerSlug } from '@/db/encryptionKey';

/**
 * Tests de la gestión de la clave de cifrado.
 *
 * Se reemplazan `expo-secure-store` y `expo-crypto` por dobles: en el entorno de test no hay
 * Keychain ni Keystore. Lo que se verifica es la lógica del módulo, no los módulos nativos.
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

let mockCounter = 0;
jest.mock('expo-crypto', () => ({
  // Bytes distintos en cada llamada, para poder distinguir una clave nueva de una reutilizada.
  getRandomBytes: jest.fn((count: number) => new Uint8Array(count).fill(++mockCounter % 256)),
}));

const setItemAsync = SecureStore.setItemAsync as jest.Mock;
const getItemAsync = SecureStore.getItemAsync as jest.Mock;

afterEach(async () => {
  await deleteEncryptionKey('operator.one');
  await deleteEncryptionKey('operator.two');
  jest.clearAllMocks();
});

describe('getOrCreateEncryptionKey', () => {
  it('genera una clave de 256 bits en hexadecimal', async () => {
    const key = await getOrCreateEncryptionKey('operator.one');

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reutiliza la clave en las llamadas siguientes', async () => {
    const first = await getOrCreateEncryptionKey('operator.one');
    const second = await getOrCreateEncryptionKey('operator.one');

    expect(second).toBe(first);
    expect(setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('da una clave distinta a cada operador', async () => {
    const one = await getOrCreateEncryptionKey('operator.one');
    const two = await getOrCreateEncryptionKey('operator.two');

    expect(two).not.toBe(one);
  });

  it('sólo guarda la clave en el almacén seguro, bajo un nombre que no delata al usuario en claro', async () => {
    await getOrCreateEncryptionKey('operator.one');

    const [name] = setItemAsync.mock.calls[0] as [string, string];
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(name).toBe(`planillero.db.key.${ownerSlug('operator.one')}`);
  });

  it('acepta identificadores con caracteres que el almacén seguro no admite', async () => {
    await expect(getOrCreateEncryptionKey('ana@example.com')).resolves.toMatch(/^[0-9a-f]{64}$/);

    const [name] = setItemAsync.mock.calls[0] as [string, string];
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
    await deleteEncryptionKey('ana@example.com');
  });

  it('no inventa una clave nueva si la guardada está dañada', async () => {
    getItemAsync.mockResolvedValueOnce('no-es-una-clave');

    await expect(getOrCreateEncryptionKey('operator.one')).rejects.toThrow('dañada');
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('propaga el error si el almacén seguro no está disponible, sin respaldo en memoria', async () => {
    setItemAsync.mockRejectedValueOnce(new Error('no disponible'));

    await expect(getOrCreateEncryptionKey('operator.one')).rejects.toThrow('no disponible');
  });
});

describe('ownerSlug', () => {
  it('distingue identificadores que un reemplazo simple confundiría', () => {
    expect(ownerSlug('a@b')).not.toBe(ownerSlug('a_b'));
  });

  it('usa ancho fijo por carácter, también para los que están fuera del plano básico', () => {
    // Con ancho variable, "😀" + "A" y otras combinaciones podrían dar la misma cadena.
    expect(ownerSlug('😀')).toHaveLength(6);
    expect(ownerSlug('A')).toHaveLength(6);
    expect(ownerSlug('😀A')).toBe(ownerSlug('😀') + ownerSlug('A'));
  });
});
