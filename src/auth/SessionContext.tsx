import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getMe, login, logout, verifyTwoFactor, type Me } from '@/api/auth';
import { clearTokens, readTokens, saveTokens, type Tokens } from '@/auth/tokenStore';

/** Estado de la sesión. `loading` es el arranque, mientras se intenta restaurar la sesión guardada. */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: SessionStatus;
  user: Me | null;
  /** Inicia sesión. Devuelve si además hace falta el código de 2FA. */
  signIn: (username: string, password: string) => Promise<{ twoFactorRequired: boolean }>;
  /** Completa el login con el código de 2FA del desafío en curso. */
  confirmTwoFactor: (code: string) => Promise<void>;
  /** Cierra la sesión local y, si se puede, la del backend. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Acceso a la sesión. Sólo puede usarse dentro de `<SessionProvider>`. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  }
  return value;
}

/**
 * Proveedor de la sesión.
 *
 * Al arrancar intenta restaurar la sesión guardada contra `GET /auth/me`: si el refresh token sigue
 * vigente, el usuario no vuelve a ver el login al reabrir la app. Si falla, se borran los tokens.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const tokens = await readTokens();
      if (!tokens) {
        if (active) {
          setStatus('signedOut');
        }
        return;
      }

      try {
        const me = await getMe();
        if (!active) {
          return;
        }
        setUser(me);
        setStatus('signedIn');
      } catch {
        await clearTokens();
        if (active) {
          setUser(null);
          setStatus('signedOut');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const startSession = useCallback(async (tokens: Tokens) => {
    await saveTokens(tokens);
    setUser(await getMe());
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const result = await login(username, password);
      if (result.twoFactorRequired) {
        setChallengeId(result.challengeId);
        return { twoFactorRequired: true };
      }
      await startSession(result.tokens);
      return { twoFactorRequired: false };
    },
    [startSession],
  );

  const confirmTwoFactor = useCallback(
    async (code: string) => {
      if (!challengeId) {
        throw new Error('No hay un desafío de 2FA en curso.');
      }
      const tokens = await verifyTwoFactor(challengeId, code);
      setChallengeId(null);
      await startSession(tokens);
    },
    [challengeId, startSession],
  );

  const signOut = useCallback(async () => {
    const tokens = await readTokens();
    if (tokens) {
      try {
        await logout(tokens.refreshToken);
      } catch {
        // La sesión local se cierra igual: el backend puede estar caído.
      }
    }
    await clearTokens();
    setChallengeId(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, confirmTwoFactor, signOut }),
    [status, user, signIn, confirmTwoFactor, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
