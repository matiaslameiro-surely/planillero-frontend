import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getHealth, type HealthResult } from '@/api/client';
import { useSession } from '@/auth/SessionContext';
import { API_URL } from '@/constants/env';
import { useThemeColors, type ThemeColors } from '@/constants/layout';
import { confirmSignOut } from '@/sync/signOutGuard';
import { useSyncQueue } from '@/sync/useSyncQueue';
import { useDeviceStatus } from '@/status/useDeviceStatus';

/** Lo que se está mostrando: la consulta en curso o su resultado. */
type HealthState = { kind: 'checking' } | { kind: 'settled'; result: HealthResult };

/**
 * Pantalla inicial, protegida.
 *
 * Muestra quién está logueado y su rol, y conserva el diagnóstico de `/salud` del esqueleto: es el
 * primer lugar donde se ve si la configuración de entorno quedó bien.
 */
export default function Home() {
  const { status } = useSession();

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return <SignedInHome />;
}

function Loading() {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgBackdrop }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function SignedInHome() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const device = useDeviceStatus();
  const queue = useSyncQueue(device.online);
  const [health, setHealth] = useState<HealthState>({ kind: 'checking' });
  const colors = useThemeColors();

  /**
   * Cerrar sesión con la cola sin vaciar es perder trabajo: la base local es del operador y se
   * cierra con la sesión. Por eso se pregunta antes, y sólo cuando hay algo que perder.
   */
  const onSignOut = useCallback(async () => {
    // Se cuenta en el momento, no se usa el número del último render: entre que se pintó la pantalla
    // y el toque pudieron encolarse o enviarse actas.
    const pendientes = await queue.reload();
    if (await confirmSignOut(pendientes)) {
      await signOut();
    }
  }, [queue, signOut]);

  const check = useCallback(async () => {
    setHealth({ kind: 'checking' });
    const result = await getHealth();
    setHealth({ kind: 'settled', result });
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgBackdrop }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Planillero</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aplicación móvil</Text>

      <View style={cardStyle}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Sesión</Text>
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>{user?.username ?? ''}</Text>
        <Text style={[styles.reason, { color: colors.textSecondary }]}>Rol: {user?.roles.join(', ') ?? ''}</Text>
      </View>

      <View style={cardStyle}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Conexión con el backend</Text>
        <HealthIndicator health={health} colors={colors} />
        <Text style={[styles.url, { color: colors.textMuted }]}>{API_URL}</Text>
      </View>

      {user?.roles.includes('OPERATOR') ? (
        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.buttonPressed]}
          onPress={() => router.push('/agenda')}
          accessibilityRole="button">
          <Text style={styles.buttonText}>Hoja de ruta</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.buttonPressed]}
        onPress={check}
        disabled={health.kind === 'checking'}
        accessibilityRole="button">
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonGhost,
          { borderColor: colors.borderStrong },
          pressed && styles.buttonPressed,
        ]}
        onPress={() => void onSignOut()}
        accessibilityRole="button">
        <Text style={[styles.buttonGhostText, { color: colors.primary }]}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function HealthIndicator({ health, colors }: { health: HealthState; colors: ThemeColors }) {
  if (health.kind === 'checking') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.textMuted }]}>Consultando…</Text>
      </View>
    );
  }

  if (health.result.status === 'connected') {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotOk]} />
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>Conectado</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotError]} />
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>Sin conexión</Text>
      </View>
      <Text style={[styles.reason, { color: colors.danger }]}>{health.result.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  label: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 18, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: { backgroundColor: '#1a9e5c' },
  dotError: { backgroundColor: '#c0392b' },
  reason: { fontSize: 13, marginTop: 4 },
  url: { fontSize: 12, fontFamily: 'monospace' },
  button: {
    width: '100%',
    maxWidth: 420,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: '#208AEF',
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonGhostText: { fontWeight: '600', fontSize: 16 },
});
