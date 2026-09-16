import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getHealth, type HealthResult } from '@/api/client';
import { useSession } from '@/auth/SessionContext';
import { API_URL } from '@/constants/env';

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
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function SignedInHome() {
  const { user, signOut } = useSession();
  const [health, setHealth] = useState<HealthState>({ kind: 'checking' });

  const check = useCallback(async () => {
    setHealth({ kind: 'checking' });
    const result = await getHealth();
    setHealth({ kind: 'settled', result });
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planillero</Text>
      <Text style={styles.subtitle}>Aplicación móvil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Sesión</Text>
        <Text style={styles.statusText}>{user?.username ?? ''}</Text>
        <Text style={styles.reason}>Rol: {user?.roles.join(', ') ?? ''}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Conexión con el backend</Text>
        <HealthIndicator health={health} />
        <Text style={styles.url}>{API_URL}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={check}
        disabled={health.kind === 'checking'}
        accessibilityRole="button">
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.button, styles.buttonGhost, pressed && styles.buttonPressed]}
        onPress={() => void signOut()}
        accessibilityRole="button">
        <Text style={styles.buttonGhostText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function HealthIndicator({ health }: { health: HealthState }) {
  if (health.kind === 'checking') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" />
        <Text style={styles.statusText}>Consultando…</Text>
      </View>
    );
  }

  if (health.result.status === 'connected') {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotOk]} />
        <Text style={styles.statusText}>Conectado</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotError]} />
        <Text style={styles.statusText}>Sin conexión</Text>
      </View>
      <Text style={styles.reason}>{health.result.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
    padding: 16,
    gap: 8,
  },
  label: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 18, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: { backgroundColor: '#1a9e5c' },
  dotError: { backgroundColor: '#c0392b' },
  reason: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  url: { fontSize: 12, opacity: 0.5, fontFamily: 'monospace' },
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
  buttonGhost: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: '#8888' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonGhostText: { color: '#208AEF', fontWeight: '600', fontSize: 16 },
});
