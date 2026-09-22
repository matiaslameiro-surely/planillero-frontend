import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VisitStatus, VisitUrgency } from '@/api/visits';
import type { AgendaVisit } from '@/agenda/agendaRepository';
import { LocationSummary } from '@/components/LocationSummary';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

/** Alto mínimo de un botón táctil, en dp: se usa con guantes y bajo el sol. */
export { MIN_TOUCH_TARGET };

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
  /** Callback opcional para abrir formulario. */
  onOpenForm?: (visit: AgendaVisit) => void;
}

/**
 * Tarjeta de una visita de la hoja de ruta: código, dirección, urgencia y estado.
 *
 * - Botón "Iniciar visita" en visitas ASSIGNED (requiere online).
 * - Botón "Completar formulario" en visitas ASSIGNED/IN_PROGRESS con form_template_id.
 */
export function VisitCard({
  visit,
  online,
  starting,
  onStart,
  onOpenForm,
}: VisitCardProps) {
  const canStart = visit.status === 'ASSIGNED';
  const disabledStart = !online || starting;

  // Mostrar botón formulario si la visita tiene plantilla asignada o está en progreso
  const hasFormTemplate = !!visit.formTemplateId;
  const canOpenForm = (visit.status === 'ASSIGNED' || visit.status === 'IN_PROGRESS') && hasFormTemplate;

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
              disabledStart && styles.buttonDisabled,
              pressed && !disabledStart && styles.buttonPressed,
            ]}
            onPress={() => onStart(visit)}
            disabled={disabledStart}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabledStart }}
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

      {canOpenForm && onOpenForm ? (
        <Pressable
          style={({ pressed }) => [
            styles.buttonForm,
            pressed && styles.buttonFormPressed,
          ]}
          onPress={() => onOpenForm(visit)}
          accessibilityRole="button"
          accessibilityLabel={`Completar formulario de ${visit.code}`}>
          <Text style={styles.buttonFormText}>Completar formulario</Text>
        </Pressable>
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
  buttonForm: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38a169',
  },
  buttonFormPressed: { opacity: 0.85 },
  buttonFormText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});