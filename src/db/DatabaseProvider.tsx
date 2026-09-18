import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useSession } from '@/auth/SessionContext';
import { ensureAgendaSchema } from '@/db/agendaSchema';
import { openEncryptedDatabase } from '@/db/database';

/** Estado de la base local del operador. */
export type DatabaseState =
  /** No hay sesión: no hay base que abrir. */
  | { status: 'closed' }
  | { status: 'opening' }
  | { status: 'ready'; db: SQLiteDatabase }
  | { status: 'error'; message: string };

const DatabaseContext = createContext<DatabaseState | null>(null);

/** Acceso a la base local. Sólo puede usarse dentro de `<DatabaseProvider>`. */
export function useDatabase(): DatabaseState {
  const value = useContext(DatabaseContext);
  if (!value) {
    throw new Error('useDatabase debe usarse dentro de <DatabaseProvider>.');
  }
  return value;
}

/**
 * Abre la base SQLite cifrada del operador logueado y la comparte con el resto de la app.
 *
 * Va dentro de `SessionProvider`: la base es del operador de la sesión, con su propia clave y su propio
 * archivo. Se abre al iniciar sesión y se cierra al salir o al desmontar, para no dejar conexiones
 * abiertas ni la base de un operador disponible para el siguiente.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const username = user?.username ?? null;
  const [state, setState] = useState<DatabaseState>({ status: 'closed' });

  useEffect(() => {
    if (status !== 'signedIn' || !username) {
      setState({ status: 'closed' });
      return;
    }

    let cancelled = false;
    let opened: SQLiteDatabase | null = null;
    setState({ status: 'opening' });

    void (async () => {
      try {
        const db = await openEncryptedDatabase(username);
        await ensureAgendaSchema(db);
        if (cancelled) {
          await db.closeAsync();
          return;
        }
        opened = db;
        setState({ status: 'ready', db });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'No se pudo abrir la base local.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (opened) {
        void opened.closeAsync();
      }
    };
  }, [status, username]);

  return <DatabaseContext.Provider value={state}>{children}</DatabaseContext.Provider>;
}
