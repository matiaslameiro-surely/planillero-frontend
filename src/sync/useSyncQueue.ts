import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { countFailedOperations, countPendingOperations } from '@/sync/syncQueue';
import { dispatchQueue } from '@/sync/syncWorker';

export interface SyncQueue {
  /** Operaciones esperando salir. Es el número que se le muestra al operador. */
  pending: number;
  /** Operaciones que el servidor rechazó y que nadie va a reintentar solo. */
  failed: number;
  /** La cola se vació recién, en esta sesión de pantalla. Sirve para confirmar y desaparecer. */
  justCleared: boolean;
  /** Hay un despacho en curso. */
  dispatching: boolean;
  /**
   * Vuelve a contar, sin tocar la red, y devuelve cuántas quedan pendientes.
   *
   * Devuelve el número además de actualizar el estado porque quien necesita decidir algo en el
   * mismo instante —como si preguntar antes de cerrar sesión— no puede esperar al próximo render.
   */
  reload: () => Promise<number>;
  /** Intenta vaciar la cola ahora. Sin conexión no hace nada. */
  dispatch: () => Promise<void>;
}

/**
 * La cola de sincronización del dispositivo.
 *
 * El despacho se dispara solo al **volver** la conexión, que es el momento en que el operador no
 * tiene por qué acordarse de nada: sale del subsuelo, la señal vuelve y sus actas se van sin que
 * toque un botón.
 *
 * No es una tarea en segundo plano del sistema operativo: mientras la app esté abierta —que es como
 * se usa en la calle— alcanza, y a cambio todo el mecanismo es probable con tests comunes.
 */
export function useSyncQueue(online: boolean): SyncQueue {
  const database = useDatabase();
  const db = database.status === 'ready' ? database.db : null;

  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [justCleared, setJustCleared] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  // Cuántas había la última vez: es lo que permite distinguir "se vació recién" de "nunca hubo
  // nada", que se ven igual mirando sólo el número actual.
  const previous = useRef(0);
  // Un despacho a la vez: dos en paralelo mandarían el mismo lote dos veces.
  const running = useRef(false);

  const reload = useCallback(async () => {
    if (!db) {
      return 0;
    }
    const [pendientes, rechazadas] = await Promise.all([
      countPendingOperations(db),
      countFailedOperations(db),
    ]);
    setPending(pendientes);
    setFailed(rechazadas);
    if (previous.current > 0 && pendientes === 0) {
      setJustCleared(true);
    }
    previous.current = pendientes;
    return pendientes;
  }, [db]);

  const dispatch = useCallback(async () => {
    if (!db || !online || running.current) {
      return;
    }
    running.current = true;
    setDispatching(true);
    try {
      await dispatchQueue(db);
    } catch {
      // `dispatchQueue` ya distingue cada fallo y deja la cola consistente. Acá sólo se evita que un
      // error inesperado rompa la pantalla: las operaciones siguen guardadas.
    } finally {
      running.current = false;
      setDispatching(false);
      await reload();
    }
  }, [db, online, reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Al montar y cada vez que la conexión vuelve. Mientras `online` sea falso no se toca la red.
  useEffect(() => {
    if (online) {
      void dispatch();
    }
  }, [online, dispatch]);

  return { pending, failed, justCleared, dispatching, reload, dispatch };
}
