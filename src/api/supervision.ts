import { requestWithAuth } from './client';

export interface HeartbeatPayload {
  batteryLevel?: number | null;
  networkStatus?: string;
  latitude?: number | null;
  longitude?: number | null;
  observations?: string;
}

export interface HeartbeatResult {
  success: boolean;
  serverTimestamp: string;
  status: string;
  message: string;
}

/**
 * Emite un latido periódico (ping) al backend con la telemetría del dispositivo del operador.
 */
export async function sendHeartbeat(payload: HeartbeatPayload): Promise<HeartbeatResult> {
  return requestWithAuth<HeartbeatResult>('/api/v1/supervision/heartbeat', {
    method: 'POST',
    body: payload,
  });
}
