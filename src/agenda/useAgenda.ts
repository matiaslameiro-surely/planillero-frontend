import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';

import { getMyRouteSheet } from '@/api/visits';
import { countPending, lastSync, listDay, replaceDay, type AgendaVisit } from '@/agenda/agendaRepository';
import { useDatabase } from '@/db/DatabaseProvider';

/** Estado de la sincronización de la agenda con el backend. */
export type SyncState = 'idle' | 'syncing' | 'failed';

export interface Agenda {
  /** Visitas del día, leídas de SQLite. */
  visits: AgendaVisit[];
  /** Cuántas siguen sin iniciarse. */
  pending: number;
  /** Cuándo se bajó por última vez la agenda de este día, o `null` si nunca. */
  lastSyncedAt: string | null;
  sync: SyncState;
  /** La base local todavía no está lista, o falló al abrirse. */
  database: 'opening' | 'ready' | 'error' | 'closed';
  databaseError: string | null;
  /** Vuelve a leer SQLite, sin tocar la red. */
  reload: () => Promise<void>;
  /** Baja la agenda del backend y la vuelca a SQLite. Sin conexión no hace nada. */
  refresh: () => Promise<void>;
  /** Abre la pantalla de formulario para una visita. */
  openFormulario: (visitId: string, templateKey?: string, templateVersion?: number) => void;
}

/**
 * Agenda del operador para un día.
 *
 * SQLite es la **única fuente** de lo que se muestra: la pantalla nunca lee de la red. Con conexión, se
 * baja el día y se vuelca a SQLite; después se lee de SQLite. Sin conexión se salta ese paso y se
 * muestra la copia guardada, así el modo offline no es un camino aparte.
 *
 * Se vuelve a sincronizar cada vez que la conexión vuelve.
 */
export function useAgenda(date: string, online: boolean): Agenda {
  const database = useDatabase();
  const db = database.status === 'ready' ? database.db : null;

  const [visits, setVisits] = useState<AgendaVisit[]>([]);
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');

  const reload = useCallback(async () => {
    if (!db) {
      return;
    }
    const [rows, count, synced] = await Promise.all([
      listDay(db, date),
      countPending(db, date),
      lastSync(db, date),
    ]);
    setVisits(rows);
    setPending(count);
    setLastSyncedAt(synced);
  }, [db, date]);

  const refresh = useCallback(async () => {
    if (!db || !online) {
      return;
    }
    setSync('syncing');
    try {
      const sheet = await getMyRouteSheet(date);
      await replaceDay(db, sheet, new Date().toISOString());
      setSync('idle');
    } catch {
      // Se conserva la copia anterior: un fallo de red no puede vaciar la agenda del operador.
      setSync('failed');
    }
    await reload();
  }, [db, date, online, reload]);

  const openFormulario = useCallback(
    (visitId: string, templateKey?: string, templateVersion?: number) => {
      const params = new URLSearchParams({ visitId });
      if (templateKey) params.set('templateKey', templateKey);
      if (templateVersion) params.set('templateVersion', String(templateVersion));
      router.push(`/formulario?${params.toString()}`);
    },
    [],
  );

  useEffect(() => {
    void refresh().then(() => undefined, () => undefined);
  }, [refresh]);

  useEffect(() => {
    void reload().then(() => undefined, () => undefined);
  }, [reload]);

  return {
    visits,
    pending,
    lastSyncedAt,
    sync,
    database: database.status,
    databaseError: database.status === 'error' ? database.message : null,
    reload,
    refresh,
    openFormulario,
  };
}