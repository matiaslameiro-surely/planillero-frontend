import { act, create } from 'react-test-renderer';

import * as supervisionApi from '@/api/supervision';
import { useHeartbeat, type UseHeartbeatReturn } from './useHeartbeat';

jest.mock('@/auth/SessionContext', () => ({
  useSession: jest.fn(),
}));

jest.mock('./useDeviceStatus', () => ({
  useDeviceStatus: jest.fn(),
}));

jest.mock('expo-location', () => ({
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@/api/supervision', () => ({
  sendHeartbeat: jest.fn(),
}));

const mockUseSession = jest.requireMock('@/auth/SessionContext').useSession;
const mockUseDeviceStatus = jest.requireMock('./useDeviceStatus').useDeviceStatus;
const mockSendHeartbeat = supervisionApi.sendHeartbeat as jest.Mock;

describe('useHeartbeat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      status: 'signedIn',
      user: { username: 'operador.demo', roles: ['OPERATOR'] },
    });
    mockUseDeviceStatus.mockReturnValue({
      online: true,
      batteryLevel: 0.85,
      gps: 'ready',
    });
    mockSendHeartbeat.mockResolvedValue({
      success: true,
      serverTimestamp: '2026-10-04T12:00:00Z',
      status: 'EN_CAMPO',
      message: 'OK',
    });
  });

  async function renderHook(enabled = true): Promise<{ current: () => UseHeartbeatReturn }> {
    let latest!: UseHeartbeatReturn;
    function Probe() {
      latest = useHeartbeat({ enabled, intervalMs: 100000 });
      return null;
    }
    await act(async () => {
      create(<Probe />);
    });
    return { current: () => latest };
  }

  it('emite latido correctamente cuando la sesión está activa', async () => {
    const hook = await renderHook(false); // deshabilitamos timer automático para prueba manual
    await act(async () => {
      await hook.current().sendPing('Test observacion');
    });

    expect(mockSendHeartbeat).toHaveBeenCalledWith({
      batteryLevel: 0.85,
      networkStatus: 'ONLINE',
      latitude: null,
      longitude: null,
      observations: 'Test observacion',
    });
    expect(hook.current().lastResult?.success).toBe(true);
  });

  it('tolera fallos silenciosamente sin lanzar excepción cuando falla la red', async () => {
    mockSendHeartbeat.mockRejectedValue(new Error('Network request failed'));
    const hook = await renderHook(false);

    await act(async () => {
      await expect(hook.current().sendPing()).resolves.not.toThrow();
    });

    expect(hook.current().lastError).toBeTruthy();
    expect(hook.current().lastError?.message).toContain('Network request failed');
  });

  it('no envía latido si el usuario no tiene sesión iniciada', async () => {
    mockUseSession.mockReturnValue({
      status: 'signedOut',
      user: null,
    });
    const hook = await renderHook(false);

    await act(async () => {
      await hook.current().sendPing();
    });

    expect(mockSendHeartbeat).not.toHaveBeenCalled();
  });
});
