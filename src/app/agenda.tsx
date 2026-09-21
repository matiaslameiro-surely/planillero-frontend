import { Redirect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { localDateString } from '@/agenda/date';
import { useAgenda } from '@/agenda/useAgenda';
import type { AgendaVisit } from '@/agenda/agendaRepository';
import { useSession } from '@/auth/SessionContext';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { SyncQueueBanner } from '@/components/SyncQueueBanner';
import { VisitCard } from '@/components/VisitCard';
import { useDatabase } from '@/db/DatabaseProvider';
import { useDeviceStatus } from '@/status/useDeviceStatus';
import { useSyncQueue } from '@/sync/useSyncQueue';
import { startVisit } from '@/visit/startVisit';

/**
 * Pantalla "Hoja de Ruta": las visitas del día del operador.
 *
 * Lee **solo de SQLite** (ver `useAgenda`), así que se ve igual con y sin conexión. La barra de estado
 * va fija arriba y no se mueve con la lista.
 */
export default function AgendaScreen() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }
  return <Agenda />;
}

function Agenda() {
  const device = useDeviceStatus();
  const database = useDatabase();
  const date = useMemo(() => localDateString(), []);
  const agenda = useAgenda(date, device.online);
  // La cola se despacha sola al volver la conexión: acá sólo se muestra en qué anda.
  const queue = useSyncQueue(device.online);

  const [startingId, setStartingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onStart = useCallback(
    async (visit: AgendaVisit) => {
      if (database.status !== 'ready' || startingId) {
        return;
      }
      setStartingId(visit.visitId);
      setNotice(null);
      try {
        const outcome = await startVisit(database.db, visit.visitId);
        if (outcome.kind === 'failed') {
          setNotice(outcome.message);
        } else if (outcome.kind === 'alreadyStarted') {
          setNotice('Esa visita ya estaba iniciada. Se actualizó la agenda.');
          await agenda.refresh();
        }
        await agenda.reload();
      } finally {
        setStartingId(null);
      }
    },
    [agenda, database, startingId],
  );

  const onOpenForm = useCallback(
    (visit: AgendaVisit) => {
      agenda.openFormulario(
        visit.visitId,
        visit.formTemplateId,
        visit.formTemplateVersion,
      );
    },
    [agenda],
  );

  return (
    <View style={styles.screen}>
      <DeviceStatusBar
        online={device.online}
        batteryLevel={device.batteryLevel}
        gps={device.gps}
        pendingVisits={agenda.pending}
      />

      <SyncQueueBanner
        pending={queue.pending}
        failed={queue.failed}
        justCleared={queue.justCleared}
        dispatching={queue.dispatching}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Hoja de ruta</Text>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.sync}>{syncText(agenda.lastSyncedAt)}</Text>
        {agenda.sync === 'failed' ? (
          <Text style={styles.warning}>
            No se pudo actualizar la agenda. Se muestra la última copia guardada.
          </Text>
        ) : null}
        {notice ? <Text style={styles.warning}>{notice}</Text> : null}
      </View>

      {agenda.database === 'opening' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Abriendo la base local…</Text>
        </View>
      ) : agenda.database === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.warning}>{agenda.databaseError}</Text>
        </View>
      ) : (
        <FlatList
          data={agenda.visits}
          keyExtractor={(visit) => visit.visitId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <VisitCard
              visit={item}
              online={device.online}
              starting={startingId === item.visitId}
              onStart={onStart}
              onOpenForm={onOpenForm}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay visitas para hoy.</Text>}
          refreshControl={
            <RefreshControl
              refreshing={agenda.sync === 'syncing'}
              onRefresh={() => void agenda.refresh()}
            />
          }
        />
      )}
    </View>
  );
}

function syncText(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) {
    return 'Todavía no se sincronizó esta agenda.';
  }
  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) {
    return 'Agenda sincronizada.';
  }
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `Última sincronización: ${time}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  date: { fontSize: 16, opacity: 0.7 },
  sync: { fontSize: 13, opacity: 0.7 },
  warning: { fontSize: 14, fontWeight: '600', color: '#c0392b' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 16, opacity: 0.7 },
});