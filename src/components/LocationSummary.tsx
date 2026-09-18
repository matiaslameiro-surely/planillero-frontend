import { StyleSheet, Text, View } from 'react-native';

import { accuracyLevel, type AccuracyLevel } from '@/visit/accuracy';

interface LocationSummaryProps {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  /** Hora de inicio, ISO-8601. */
  startedAt: string;
}

/** Color y texto del semáforo. El texto acompaña al color para no depender sólo de distinguirlo. */
export const ACCURACY_STYLE: Record<AccuracyLevel, { color: string; label: string }> = {
  green: { color: '#1a9e5c', label: 'Precisión buena' },
  yellow: { color: '#d68910', label: 'Precisión aceptable' },
  red: { color: '#c0392b', label: 'Precisión baja' },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Bloque **no editable** con lo que se registró al iniciar la visita: latitud, longitud, radio de
 * precisión con su semáforo y hora de inicio.
 *
 * Son sólo `Text`, nunca un campo de entrada: lo que se muestra es lo que el servidor guardó.
 */
export function LocationSummary({ latitude, longitude, accuracyMeters, startedAt }: LocationSummaryProps) {
  const level = ACCURACY_STYLE[accuracyLevel(accuracyMeters)];

  return (
    <View style={styles.box} accessibilityLabel="Ubicación registrada al iniciar la visita">
      <Text style={styles.row}>{`Latitud: ${latitude.toFixed(6)}`}</Text>
      <Text style={styles.row}>{`Longitud: ${longitude.toFixed(6)}`}</Text>
      <View style={styles.accuracyRow}>
        <View style={[styles.dot, { backgroundColor: level.color }]} />
        <Text style={styles.row}>{`Precisión: ${Math.round(accuracyMeters)} m · ${level.label}`}</Text>
      </View>
      <Text style={styles.row}>{`Inicio: ${formatTime(startedAt)}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
  },
  row: { fontSize: 15 },
  accuracyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
