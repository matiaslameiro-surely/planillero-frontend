import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { countFailedOperations, countPendingOperations } from '@/sync/syncQueue';
import { dispatchQueue } from '@/sync/syncWorker';

/**
 * Cuántos lotes seguidos se mandan en un mismo despacho.
 *
 * Es un tope de seguridad, no una cuota: corta un ciclo que no avanza (por ejemplo, si el servidor
 * contestara siempre que quedan pendientes). Con 50 operaciones por lote, alcanza para vaciar una
 * cola de mil.
 */
const MAX_BATCHES_PER_DISPATCH = 20;

/** Cuánto queda visible la confirmación de «todo sincronizado» antes de irse sola. */
const CLEARED_NOTICE_MS = 5000;

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
      // Se encadenan lotes mientras el envío avance. Con un solo lote por despacho, una cola más
      // grande que el tamaño de lote se quedaría a medias hasta que la red se cortara y volviera
      // otra vez, con el dispositivo conectado todo el tiempo.
      for (let vuelta = 0; vuelta < MAX_BATCHES_PER_DISPATCH; vuelta += 1) {
        const result = await dispatchQueue(db);
        // Nada que enviar, algo que falló, o ya no queda nada: en los tres casos insistir no ayuda.
        if (result.sent === 0 || result.failure !== null || result.pending === 0) {
          break;
        }
      }
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

  // La confirmación se muestra un rato y se va. Un cartel que se queda deja de confirmar algo y pasa
  // a ser parte del decorado, que es como no haber confirmado nada.
  useEffect(() => {
    if (!justCleared) {
      return;
    }
    const timer = setTimeout(() => setJustCleared(false), CLEARED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [justCleared]);

  // Al montar y cada vez que la conexión vuelve. Mientras `online` sea falso no se toca la red.
  useEffect(() => {
    if (online) {
      void dispatch();
    }
  }, [online, dispatch]);

  return { pending, failed, justCleared, dispatching, reload, dispatch };
}
