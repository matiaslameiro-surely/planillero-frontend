import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDateString } from '@/agenda/date';
import { useAgenda } from '@/agenda/useAgenda';
import type { AgendaVisit } from '@/agenda/agendaRepository';
import { useSession } from '@/auth/SessionContext';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { SyncQueueBanner } from '@/components/SyncQueueBanner';
import { VisitCard } from '@/components/VisitCard';
import { useDatabase } from '@/db/DatabaseProvider';
import { useDeviceStatus } from '@/status/useDeviceStatus';
import { confirmSignOut } from '@/sync/signOutGuard';
import { useSyncQueue } from '@/sync/useSyncQueue';
import { startVisit } from '@/visit/startVisit';
import { completeVisit } from '@/visit/completeVisit';
import { MIN_TOUCH_TARGET, useThemeColors } from '@/constants/layout';

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
  const router = useRouter();
  const { signOut } = useSession();
  const device = useDeviceStatus();
  const database = useDatabase();
  const date = useMemo(() => localDateString(), []);
  const agenda = useAgenda(date, device.online);
  const colors = useThemeColors();
  // La cola se despacha sola al volver la conexión: acá sólo se muestra en qué anda.
  const queue = useSyncQueue(device.online);

  const [startingId, setStartingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const onSignOut = useCallback(async () => {
    const pendientes = await queue.reload();
    if (await confirmSignOut(pendientes)) {
      await signOut();
    }
  }, [queue, signOut]);

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

  const onOpenEvidence = useCallback((visit: AgendaVisit) => {
    router.push(`/evidence/${visit.visitId}`);
  }, [router]);

  const onOpenForm = useCallback(
    (visit: AgendaVisit) => {
      agenda.openFormulario(
        visit.visitId,
        visit.formTemplateId || 'control-de-acceso',
        visit.formTemplateVersion ?? 1,
      );
    },
    [agenda],
  );

  const onComplete = useCallback(
    (visit: AgendaVisit) => {
      if (database.status !== 'ready' || completingId) {
        return;
      }
      Alert.alert(
        'Finalizar visita',
        `¿Confirmás que deseás finalizar la visita ${visit.code}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Finalizar',
            style: 'destructive',
            onPress: async () => {
              setCompletingId(visit.visitId);
              setNotice(null);
              try {
                const outcome = await completeVisit(database.db, visit.visitId);
                if (outcome.kind === 'failed') {
                  setNotice(outcome.message);
                } else if (outcome.kind === 'alreadyCompleted') {
                  setNotice('Esa visita ya estaba finalizada. Se actualizó la agenda.');
                  await agenda.refresh();
                }
                await agenda.reload();
              } finally {
                setCompletingId(null);
              }
            },
          },
        ],
      );
    },
    [agenda, completingId, database],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.bgBackdrop }]}>
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

      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.bgSurface,
            borderBottomColor: colors.borderDefault,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla principal"
        >
          <Text style={[styles.navBackText, { color: colors.primary }]}>← Volver</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => void onSignOut()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text style={[styles.navLogoutText, { color: colors.danger }]}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Hoja de ruta</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
        <Text style={[styles.sync, { color: colors.textMuted }]}>{syncText(agenda.lastSyncedAt)}</Text>
        {agenda.sync === 'failed' ? (
          <Text style={[styles.warning, { color: colors.danger }]}>
            No se pudo actualizar la agenda. Se muestra la última copia guardada.
          </Text>
        ) : null}
        {notice ? <Text style={[styles.warning, { color: colors.warning }]}>{notice}</Text> : null}
      </View>

      {agenda.database === 'opening' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary }}>Abriendo la base local…</Text>
        </View>
      ) : agenda.database === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.warning, { color: colors.danger }]}>{agenda.databaseError}</Text>
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
              completing={completingId === item.visitId}
              onStart={onStart}
              onOpenForm={onOpenForm}
              onOpenEvidence={onOpenEvidence}
              onComplete={onComplete}
            />
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No hay visitas para hoy.</Text>}
          refreshControl={
            <RefreshControl
              refreshing={agenda.sync === 'syncing'}
              onRefresh={() => void agenda.refresh()}
            />
          }
        />
      )}
    </SafeAreaView>
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
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  navBackText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navLogoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  date: { fontSize: 16 },
  sync: { fontSize: 13 },
  warning: { fontSize: 14, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 16 },
});