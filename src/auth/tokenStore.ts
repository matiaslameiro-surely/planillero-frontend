import * as SecureStore from 'expo-secure-store';

/** Par de tokens de una sesión. */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_KEY = 'planillero.access';
const REFRESH_KEY = 'planillero.refresh';

/**
 * Respaldo en memoria para cuando no hay almacenamiento seguro disponible.
 *
 * `expo-secure-store` no existe en la web (y puede faltar en un entorno de test). En ese caso la
 * sesión vive sólo mientras la app esté abierta, que es preferible a romper el arranque.
 */
const fallback = new Map<string, string>();

async function write(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    // cae al respaldo
  }
  fallback.set(key, value);
}

async function read(key: string): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (stored !== null) {
      return stored;
    }
  } catch {
    // cae al respaldo
  }
  return fallback.get(key) ?? null;
}

async function remove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // cae al respaldo
  }
  fallback.delete(key);
}

/** Guarda el par de tokens de la sesión. */
export async function saveTokens(tokens: Tokens): Promise<void> {
  await write(ACCESS_KEY, tokens.accessToken);
  await write(REFRESH_KEY, tokens.refreshToken);
}

/** Lee el par de tokens guardado, o `null` si no hay sesión. */
export async function readTokens(): Promise<Tokens | null> {
  const accessToken = await read(ACCESS_KEY);
  const refreshToken = await read(REFRESH_KEY);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

/** Borra los tokens guardados. No falla si no había nada. */
export async function clearTokens(): Promise<void> {
  await remove(ACCESS_KEY);
  await remove(REFRESH_KEY);
}
