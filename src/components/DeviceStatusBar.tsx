import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/constants/layout';
import type { GpsState } from '@/status/useDeviceStatus';

interface DeviceStatusBarProps {
  online: boolean;
  /** Carga de la batería de 0 a 1, o `null` si no se conoce. */
  batteryLevel: number | null;
  gps: GpsState;
  /** Visitas de la agenda que todavía no se iniciaron. */
  pendingVisits: number;
}

const GPS_LABEL: Record<GpsState, string> = {
  ready: 'GPS listo',
  disabled: 'GPS apagado',
  denied: 'GPS sin permiso',
  unknown: 'GPS sin datos',
};

/**
 * Barra fija con el estado del dispositivo: modo offline o conectado, batería, GPS y visitas
 * pendientes.
 *
 * Es sólo presentación: recibe los datos por props (de `useDeviceStatus` y de la agenda) para poder
 * probarla sin sensores. El estado se dice con texto además de con color, para que se entienda con
 * mucho sol y para quien no distingue colores.
 *
 * Los colores de la barra salen del tema: sin un color explícito, Android pinta el texto en negro y
 * en tema oscuro queda invisible (PLAN-57). La barra lleva su propio fondo para que el contraste no
 * dependa de la pantalla que la contiene.
 */
export function DeviceStatusBar({ online, batteryLevel, gps, pendingVisits }: DeviceStatusBarProps) {
  const battery = batteryLevel === null ? 'Batería sin datos' : `Batería ${Math.round(batteryLevel * 100)}%`;
  const pending = pendingVisits === 1 ? '1 visita pendiente' : `${pendingVisits} visitas pendientes`;
  const colors = useThemeColors();
  const itemColor = { color: colors.textSecondary };

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.bgBackdrop, borderBottomColor: colors.borderDefault }]}
      accessibilityRole="summary"
      accessibilityLabel="Estado del dispositivo"
    >
      <View style={[styles.mode, online ? styles.modeOnline : styles.modeOffline]}>
        <Text style={styles.modeText}>{online ? 'Modo conectado' : 'Modo offline'}</Text>
      </View>
      <Text style={[styles.item, itemColor]}>{battery}</Text>
      <Text style={[styles.item, itemColor, gps !== 'ready' && [styles.itemWarning, { color: colors.danger }]]}>
        {GPS_LABEL[gps]}
      </Text>
      <Text style={[styles.item, itemColor]}>{pending}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mode: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  // Fijos en los dos temas: el chip lleva su propio fondo y el texto siempre es blanco. El verde es
  // el `success` del tema claro (5.02:1 con blanco); el anterior, #1a9e5c, daba 3.45:1.
  modeOnline: { backgroundColor: '#15803d' },
  modeOffline: { backgroundColor: '#c0392b' },
  modeText: { color: '#fff', fontWeight: '700' },
  item: { fontSize: 14 },
  itemWarning: { fontWeight: '700' },
});
