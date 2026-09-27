import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface SyncQueueBannerProps {
  /** Actas esperando salir. */
  pending: number;
  /** Actas que el servidor rechazó. */
  failed: number;
  /** La cola se vació recién: se confirma y después desaparece. */
  justCleared: boolean;
  /** Hay un envío en curso. */
  dispatching: boolean;
}

/**
 * Estado de la cola de sincronización, en la pantalla del operador.
 *
 * Trabajar sin conexión da miedo con razón: el operador no ve dónde quedó lo que cargó. Este cartel
 * contesta esa pregunta sin que tenga que buscarla, y confirma cuando ya no queda nada — el silencio
 * no alcanza como confirmación, porque es igual al silencio de que algo salió mal.
 *
 * El estado se dice con texto además de con color: la tablet se usa al sol y no todo el mundo
 * distingue colores.
 */
export function SyncQueueBanner({
  pending,
  failed,
  justCleared,
  dispatching,
}: SyncQueueBannerProps) {
  if (pending === 0 && failed === 0 && !justCleared) {
    return null;
  }

  if (pending === 0 && failed === 0) {
    return (
      <View style={[styles.banner, styles.done]} accessibilityRole="summary" accessibilityLiveRegion="polite">
        <Text style={styles.doneText}>✓ Todo sincronizado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.waiting]} accessibilityRole="summary" accessibilityLiveRegion="polite">
      {pending > 0 ? (
        <View style={styles.row}>
          {dispatching ? <ActivityIndicator size="small" color="#fff" /> : null}
          {/* Una sola cadena y no texto con una interpolación en el medio: así el lector de
              pantalla la lee de corrido en vez de anunciarla en pedazos. */}
          <Text style={styles.waitingText}>
            {`Cola de sincronización: ${
              pending === 1 ? '1 acta pendiente' : `${pending} actas pendientes`
            }`}
          </Text>
        </View>
      ) : null}

      {failed > 0 ? (
        <Text style={styles.failedText}>
          {failed === 1
            ? '1 acta no pudo enviarse. Revisala con tu supervisor.'
            : `${failed} actas no pudieron enviarse. Revisalas con tu supervisor.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waiting: { backgroundColor: '#b9770e' },
  waitingText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  failedText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  // Fijo en los dos temas: el banner lleva su propio fondo y el texto siempre es blanco. El verde es
  // el `success` del tema claro (#15803d, 5.02:1 con blanco); el anterior, #1a9e5c, daba 3.45:1 (PLAN-67).
  done: { backgroundColor: '#15803d' },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
