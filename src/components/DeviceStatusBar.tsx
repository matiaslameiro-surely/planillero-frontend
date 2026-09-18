import { StyleSheet, Text, View } from 'react-native';

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
 */
export function DeviceStatusBar({ online, batteryLevel, gps, pendingVisits }: DeviceStatusBarProps) {
  const battery = batteryLevel === null ? 'Batería sin datos' : `Batería ${Math.round(batteryLevel * 100)}%`;
  const pending = pendingVisits === 1 ? '1 visita pendiente' : `${pendingVisits} visitas pendientes`;

  return (
    <View style={styles.bar} accessibilityRole="header" accessibilityLabel="Estado del dispositivo">
      <View style={[styles.mode, online ? styles.modeOnline : styles.modeOffline]}>
        <Text style={styles.modeText}>{online ? 'Modo conectado' : 'Modo offline'}</Text>
      </View>
      <Text style={styles.item}>{battery}</Text>
      <Text style={[styles.item, gps !== 'ready' && styles.itemWarning]}>{GPS_LABEL[gps]}</Text>
      <Text style={styles.item}>{pending}</Text>
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
    borderBottomColor: '#8888',
  },
  mode: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  modeOnline: { backgroundColor: '#1a9e5c' },
  modeOffline: { backgroundColor: '#c0392b' },
  modeText: { color: '#fff', fontWeight: '700' },
  item: { fontSize: 14 },
  itemWarning: { fontWeight: '700', color: '#c0392b' },
});
