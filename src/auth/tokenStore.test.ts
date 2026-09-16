import * as SecureStore from 'expo-secure-store';

import { clearTokens, readTokens, saveTokens } from '@/auth/tokenStore';

/**
 * Tests del almacén de tokens.
 *
 * Se reemplaza `expo-secure-store` por un almacén en memoria: en el entorno de test no hay Keychain
 * ni Keystore. Lo que se verifica es la lógica del módulo (qué guarda, qué devuelve y cuándo borra),
 * no el módulo nativo.
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

const setItemAsync = SecureStore.setItemAsync as jest.Mock;

afterEach(async () => {
  await clearTokens();
  jest.clearAllMocks();
});

describe('tokenStore', () => {
  it('guarda y devuelve el par de tokens', async () => {
    await saveTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await expect(readTokens()).resolves.toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('devuelve null cuando no hay sesión', async () => {
    await expect(readTokens()).resolves.toBeNull();
  });

  it('borra los tokens guardados', async () => {
    await saveTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await clearTokens();

    await expect(readTokens()).resolves.toBeNull();
  });

  it('igual guarda si el almacenamiento seguro no está disponible', async () => {
    // Sin SecureStore (por ejemplo, en la web) la sesión vive en memoria.
    setItemAsync.mockRejectedValue(new Error('no disponible'));

    await saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    await expect(readTokens()).resolves.toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });
});
