import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { useNetworkState } from 'expo-network';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useDeviceStatus, type DeviceStatus } from '@/status/useDeviceStatus';

/**
 * Tests del estado del dispositivo.
 *
 * Se reemplazan `expo-network`, `expo-battery` y `expo-location` por dobles: en el entorno de test no
 * hay sensores. Lo que se verifica es cómo el hook combina lo que devuelven, no los módulos nativos.
 */

jest.mock('expo-network', () => ({ useNetworkState: jest.fn() }));
jest.mock('expo-battery', () => ({ useBatteryLevel: jest.fn() }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
}));

const networkState = useNetworkState as jest.Mock;
const batteryLevel = Battery.useBatteryLevel as jest.Mock;
const getPermissions = Location.getForegroundPermissionsAsync as jest.Mock;
const servicesEnabled = Location.hasServicesEnabledAsync as jest.Mock;

/** Renderiza el hook y devuelve una función para leer el último valor. */
async function renderStatus(): Promise<{ current: () => DeviceStatus; unmount: () => Promise<void> }> {
  let latest!: DeviceStatus;
  function Probe() {
    latest = useDeviceStatus();
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  // `act` asíncrono para que termine la primera consulta del GPS antes de leer.
  await act(async () => {
    renderer = create(<Probe />);
  });
  return {
    current: () => latest,
    unmount: () =>
      act(async () => {
        renderer.unmount();
      }),
  };
}

beforeEach(() => {
  networkState.mockReturnValue({ isConnected: true, isInternetReachable: true });
  batteryLevel.mockReturnValue(0.5);
  getPermissions.mockResolvedValue({ granted: true });
  servicesEnabled.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

describe('useDeviceStatus', () => {
  it('informa conectado, batería y GPS listo', async () => {
    const { current } = await renderStatus();

    expect(current()).toEqual({ online: true, batteryLevel: 0.5, gps: 'ready' });
  });

  it('informa offline cuando no hay internet alcanzable', async () => {
    networkState.mockReturnValue({ isConnected: true, isInternetReachable: false });

    expect((await renderStatus()).current().online).toBe(false);
  });

  it('usa isConnected mientras el sistema no validó la red', async () => {
    networkState.mockReturnValue({ isConnected: false, isInternetReachable: undefined });

    expect((await renderStatus()).current().online).toBe(false);
  });

  it('asume conectado si el sistema no da ningún dato de red', async () => {
    networkState.mockReturnValue({});

    expect((await renderStatus()).current().online).toBe(true);
  });

  it('traduce el -1 de Expo a batería desconocida', async () => {
    batteryLevel.mockReturnValue(-1);

    expect((await renderStatus()).current().batteryLevel).toBeNull();
  });

  it('informa gps denied cuando falta el permiso', async () => {
    getPermissions.mockResolvedValue({ granted: false });

    expect((await renderStatus()).current().gps).toBe('denied');
  });

  it('informa gps disabled cuando el permiso está pero el GPS está apagado', async () => {
    servicesEnabled.mockResolvedValue(false);

    expect((await renderStatus()).current().gps).toBe('disabled');
  });

  it('informa gps unknown si la consulta falla', async () => {
    getPermissions.mockRejectedValue(new Error('sin proveedor'));

    expect((await renderStatus()).current().gps).toBe('unknown');
  });

  it('vuelve a consultar el GPS cuando la app vuelve a primer plano', async () => {
    let onChange: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: string) => void;
      return { remove };
    });
    const { current, unmount } = await renderStatus();
    expect(current().gps).toBe('ready');

    // El operador apagó el GPS desde el sistema y volvió a la app.
    servicesEnabled.mockResolvedValue(false);
    await act(async () => {
      onChange('active');
    });

    expect(current().gps).toBe('disabled');

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
