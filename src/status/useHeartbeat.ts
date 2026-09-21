import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { sendHeartbeat, type HeartbeatPayload, type HeartbeatResult } from '@/api/supervision';
import { useSession } from '@/auth/SessionContext';
import { useDeviceStatus } from './useDeviceStatus';

export interface UseHeartbeatOptions {
  /** Intervalo en milisegundos entre latidos periódicos (por defecto 60 segundos). */
  intervalMs?: number;
  /** Permite pausar o forzar la activación del emisor. Por defecto activo cuando hay sesión iniciada. */
  enabled?: boolean;
}

export interface UseHeartbeatReturn {
  lastResult: HeartbeatResult | null;
  lastError: Error | null;
  isSending: boolean;
  sendPing: (observations?: string) => Promise<void>;
}

/**
 * Hook para emisión periódica y resiliente de latidos operativos (heartbeats).
 *
 * <p>Transmite periódicamente al backend la telemetría del dispositivo:
 * nivel de batería, estado de conexión de red y coordenadas geográficas si están disponibles.
 * Diseñado para fallar en silencio sin bloquear al usuario en escenarios offline.
 */
export function useHeartbeat(options: UseHeartbeatOptions = {}): UseHeartbeatReturn {
  const { intervalMs = 60000, enabled = true } = options;
  const { status: sessionStatus, user } = useSession();
  const deviceStatus = useDeviceStatus();

  const [lastResult, setLastResult] = useState<HeartbeatResult | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Referencias para evitar recrear timers ante cambios de estado transitorios
  const deviceStatusRef = useRef(deviceStatus);
  deviceStatusRef.current = deviceStatus;

  const isOperator = user?.roles?.includes('OPERATOR') ?? true;

  const sendPing = useCallback(
    async (observations?: string) => {
      if (sessionStatus !== 'signedIn' || !isOperator) {
        return;
      }

      setIsSending(true);
      setLastError(null);

      try {
        let latitude: number | null = null;
        let longitude: number | null = null;

        if (deviceStatusRef.current.gps === 'ready') {
          try {
            const loc =
              (await Location.getLastKnownPositionAsync()) ??
              (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
            if (loc?.coords) {
              latitude = loc.coords.latitude;
              longitude = loc.coords.longitude;
            }
          } catch {
            // Falla de GPS no bloquea el envío de batería y conectividad
          }
        }

        const payload: HeartbeatPayload = {
          batteryLevel: deviceStatusRef.current.batteryLevel,
          networkStatus: deviceStatusRef.current.online ? 'ONLINE' : 'OFFLINE',
          latitude,
          longitude,
          observations,
        };

        const result = await sendHeartbeat(payload);
        setLastResult(result);
      } catch (err) {
        // En modo offline o ante fallos transitorios, registramos el error sin molestar al usuario
        setLastError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsSending(false);
      }
    },
    [sessionStatus, isOperator],
  );

  useEffect(() => {
    if (!enabled || sessionStatus !== 'signedIn' || !isOperator) {
      return;
    }

    // Disparo inicial diferido brevemente para no competir con el arranque
    const initialTimer = setTimeout(() => {
      void sendPing();
    }, 2000);

    const intervalTimer = setInterval(() => {
      void sendPing();
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [enabled, sessionStatus, isOperator, intervalMs, sendPing]);

  return {
    lastResult,
    lastError,
    isSending,
    sendPing,
  };
}
