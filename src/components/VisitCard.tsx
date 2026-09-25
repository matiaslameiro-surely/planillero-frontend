import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VisitStatus, VisitUrgency } from '@/api/visits';
import type { AgendaVisit } from '@/agenda/agendaRepository';
import { LocationSummary } from '@/components/LocationSummary';
import { MIN_TOUCH_TARGET, useThemeColors, type ThemeColors } from '@/constants/layout';

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

function getStatusColor(status: VisitStatus, colors: ThemeColors): string {
  switch (status) {
    case 'IN_PROGRESS':
      return colors.primary;
    case 'COMPLETED':
      return colors.success;
    case 'CANCELLED':
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

interface VisitCardProps {
  visit: AgendaVisit;
  /** Hay conexión con el backend: iniciar una visita la exige. */
  online: boolean;
  /** Se está iniciando esta visita. */
  starting: boolean;
  /** Se está finalizando esta visita. */
  completing?: boolean;
  onStart: (visit: AgendaVisit) => void;
  /** Callback opcional para abrir formulario. */
  onOpenForm?: (visit: AgendaVisit) => void;
  /** Callback opcional para abrir evidencias periciales (fotos y firma). */
  onOpenEvidence?: (visit: AgendaVisit) => void;
  /** Callback opcional para finalizar la visita. */
  onComplete?: (visit: AgendaVisit) => void;
}

/**
 * Tarjeta de una visita de la hoja de ruta: código, dirección, urgencia y estado.
 *
 * - Botón "Iniciar visita" en visitas ASSIGNED (requiere online).
 * - Botones "Evidencias / Fotos y Firma", "Completar formulario" y "Finalizar visita" en visitas IN_PROGRESS.
 */
export function VisitCard({
  visit,
  online,
  starting,
  completing,
  onStart,
  onOpenForm,
  onOpenEvidence,
  onComplete,
}: VisitCardProps) {
  const colors = useThemeColors();
  const canStart = visit.status === 'ASSIGNED';
  const isInProgress = visit.status === 'IN_PROGRESS';
  const disabledStart = !online || starting;
  const disabledComplete = !online || !!completing;

  // Mostrar botón formulario si la visita tiene plantilla asignada o está en progreso (con fallback)
  const hasFormTemplate = !!visit.formTemplateId;
  const canOpenForm = (visit.status === 'ASSIGNED' && hasFormTemplate) || isInProgress;

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}>
      <View style={styles.header}>
        <Text style={[styles.code, { color: colors.textPrimary }]}>{visit.code}</Text>
        <Text style={[styles.status, { color: getStatusColor(visit.status, colors) }]}>
          {STATUS_LABEL[visit.status]}
        </Text>
      </View>
      <Text style={[styles.address, { color: colors.textSecondary }]}>{visit.address}</Text>
      <Text style={[styles.urgency, { color: colors.textMuted }]}>{URGENCY_LABEL[visit.urgency]}</Text>

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
              { backgroundColor: colors.primary },
              disabledStart && { backgroundColor: colors.borderStrong },
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
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Iniciar la visita requiere conexión con el servidor.
            </Text>
          ) : null}
        </>
      ) : null}

      {isInProgress && onOpenEvidence ? (
        <Pressable
          style={({ pressed }) => [
            styles.buttonEvidence,
            { backgroundColor: colors.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onOpenEvidence(visit)}
          accessibilityRole="button"
          accessibilityLabel={`Evidencias y firma de ${visit.code}`}>
          <Text style={styles.buttonText}>Evidencias / Fotos y Firma</Text>
        </Pressable>
      ) : null}

      {canOpenForm && onOpenForm ? (
        <Pressable
          style={({ pressed }) => [
            styles.buttonForm,
            { backgroundColor: colors.success },
            pressed && styles.buttonFormPressed,
          ]}
          onPress={() => onOpenForm(visit)}
          accessibilityRole="button"
          accessibilityLabel={`Completar formulario de ${visit.code}`}>
          <Text style={styles.buttonFormText}>Completar formulario</Text>
        </Pressable>
      ) : null}

      {isInProgress && onComplete ? (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.buttonComplete,
              { backgroundColor: colors.warning },
              disabledComplete && { backgroundColor: colors.borderStrong },
              pressed && !disabledComplete && styles.buttonPressed,
            ]}
            onPress={() => onComplete(visit)}
            disabled={disabledComplete}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabledComplete }}
            accessibilityLabel={`Finalizar visita ${visit.code}`}>
            {completing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Finalizar visita</Text>
            )}
          </Pressable>
          {!online ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Finalizar la visita requiere conexión con el servidor.
            </Text>
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
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 18, fontWeight: '700' },
  status: { fontSize: 14, fontWeight: '600' },
  address: { fontSize: 16 },
  urgency: { fontSize: 14 },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#8888' },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13 },
  buttonForm: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFormPressed: { opacity: 0.85 },
  buttonFormText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buttonEvidence: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonComplete: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});