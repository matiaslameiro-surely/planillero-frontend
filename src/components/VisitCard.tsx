import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VisitStatus, VisitUrgency } from '@/api/visits';
import type { AgendaVisit } from '@/agenda/agendaRepository';
import { LocationSummary } from '@/components/LocationSummary';

/** Alto mínimo de un botón táctil, en dp: se usa con guantes y bajo el sol. */
export const MIN_TOUCH_TARGET = 48;

const STATUS_LABEL: Record<VisitStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const URGENCY_LABEL: Record<VisitUrgency, string> = {
  HIGH: 'Urgencia alta',
  MEDIUM: 'Urgencia media',
  LOW: 'Urgencia baja',
};

interface VisitCardProps {
  visit: AgendaVisit;
  /** Hay conexión con el backend: iniciar una visita la exige. */
  online: boolean;
  /** Se está iniciando esta visita. */
  starting: boolean;
  onStart: (visit: AgendaVisit) => void;
}

/**
 * Tarjeta de una visita de la hoja de ruta: código, dirección, urgencia y estado.
 *
 * El botón "Iniciar visita" sólo aparece en visitas asignadas. Sin conexión queda deshabilitado y lo
 * explica con un texto: el inicio se registra en el servidor y no se encola (eso es la sincronización
 * diferida, otra tarea).
 */
export function VisitCard({ visit, online, starting, onStart }: VisitCardProps) {
  const canStart = visit.status === 'ASSIGNED';
  const disabled = !online || starting;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.code}>{visit.code}</Text>
        <Text style={styles.status}>{STATUS_LABEL[visit.status]}</Text>
      </View>
      <Text style={styles.address}>{visit.address}</Text>
      <Text style={styles.urgency}>{URGENCY_LABEL[visit.urgency]}</Text>

      {visit.status === 'IN_PROGRESS' && visit.start ? (
        <LocationSummary
          latitude={visit.start.latitude}
          longitude={visit.start.longitude}
          accuracyMeters={visit.start.accuracyMeters}
          startedAt={visit.start.startedAt}
        />
      ) : null}

      {canStart ? (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              disabled && styles.buttonDisabled,
              pressed && !disabled && styles.buttonPressed,
            ]}
            onPress={() => onStart(visit)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={`Iniciar visita ${visit.code}`}>
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Iniciar visita</Text>
            )}
          </Pressable>
          {!online ? (
            <Text style={styles.hint}>Iniciar la visita requiere conexión con el servidor.</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 18, fontWeight: '700' },
  status: { fontSize: 14, fontWeight: '600' },
  address: { fontSize: 16 },
  urgency: { fontSize: 14, opacity: 0.8 },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },
  buttonDisabled: { backgroundColor: '#8888' },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13, opacity: 0.8 },
});
