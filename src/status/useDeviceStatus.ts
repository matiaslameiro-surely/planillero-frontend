import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { useNetworkState } from 'expo-network';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Estado del GPS del dispositivo.
 *
 * - `ready`: permiso concedido y GPS encendido
 * - `disabled`: permiso concedido pero el GPS está apagado
 * - `denied`: el usuario no concedió el permiso de ubicación
 * - `unknown`: todavía no se consultó, o la consulta falló
 */
export type GpsState = 'ready' | 'disabled' | 'denied' | 'unknown';

/** Lo que muestra la barra de estado. */
export interface DeviceStatus {
  /** `true` si el dispositivo tiene conexión. Sin dato del sistema se asume conectado. */
  online: boolean;
  /** Carga de la batería de 0 a 1, o `null` si el dispositivo no la informa. */
  batteryLevel: number | null;
  gps: GpsState;
}

/**
 * Estado en vivo del dispositivo: conectividad, batería y GPS.
 *
 * El GPS no emite eventos de cambio, así que se vuelve a consultar cada vez que la app vuelve a
 * primer plano: es cuando el operador pudo haber tocado el permiso o el interruptor del sistema.
 */
export function useDeviceStatus(): DeviceStatus {
  const network = useNetworkState();
  const rawBattery = Battery.useBatteryLevel();
  const [gps, setGps] = useState<GpsState>('unknown');

  const refreshGps = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        setGps('denied');
        return;
      }
      setGps((await Location.hasServicesEnabledAsync()) ? 'ready' : 'disabled');
    } catch {
      setGps('unknown');
    }
  }, []);

  useEffect(() => {
    void refreshGps();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshGps();
      }
    });
    return () => subscription.remove();
  }, [refreshGps]);

  return {
    // Con `isInternetReachable` no alcanza: en iOS es siempre igual a `isConnected`, y en Android
    // puede ser `undefined` mientras el sistema todavía no validó la red.
    online: network.isInternetReachable ?? network.isConnected ?? true,
    // Expo devuelve -1 cuando el dispositivo no informa el nivel de batería.
    batteryLevel: rawBattery >= 0 ? rawBattery : null,
    gps,
  };
}
