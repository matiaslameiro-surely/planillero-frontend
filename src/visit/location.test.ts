import * as Location from 'expo-location';

import { captureLocation, FIX_TIMEOUT_MS, LocationError } from '@/visit/location';

/**
 * Tests de la captura de ubicación.
 *
 * Se reemplaza `expo-location` por un doble: en el entorno de test no hay GPS. Lo que se verifica es
 * la lógica del módulo (qué acepta, qué rechaza y con qué código), no el proveedor nativo.
 */

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const getPermissions = Location.getForegroundPermissionsAsync as jest.Mock;
const requestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock;
const servicesEnabled = Location.hasServicesEnabledAsync as jest.Mock;
const getPosition = Location.getCurrentPositionAsync as jest.Mock;

function position(overrides: { mocked?: boolean; accuracy?: number | null } = {}) {
  return {
    coords: {
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 'accuracy' in overrides ? overrides.accuracy : 8,
    },
    timestamp: 1_700_000_000_000,
    ...(overrides.mocked === undefined ? {} : { mocked: overrides.mocked }),
  };
}

async function errorOf(promise: Promise<unknown>): Promise<LocationError> {
  try {
    await promise;
  } catch (e) {
    return e as LocationError;
  }
  throw new Error('Se esperaba un LocationError y no falló.');
}

beforeEach(() => {
  getPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  requestPermissions.mockResolvedValue({ granted: true });
  servicesEnabled.mockResolvedValue(true);
  getPosition.mockResolvedValue(position());
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('captureLocation', () => {
  it('devuelve la lectura con coordenadas, precisión y hora del dispositivo', async () => {
    const before = Date.now();

    const result = await captureLocation();

    expect(result.latitude).toBe(-34.6037);
    expect(result.longitude).toBe(-58.3816);
    expect(result.accuracyMeters).toBe(8);
    expect(result.capturedAt).toBeGreaterThanOrEqual(before);
    expect(result.capturedAt).toBeLessThanOrEqual(Date.now());
  });

  it('acepta una lectura marcada como no simulada', async () => {
    getPosition.mockResolvedValue(position({ mocked: false }));

    await expect(captureLocation()).resolves.toMatchObject({ accuracyMeters: 8 });
  });

  it('rechaza una lectura simulada (mock location)', async () => {
    getPosition.mockResolvedValue(position({ mocked: true }));

    const error = await errorOf(captureLocation());

    expect(error).toBeInstanceOf(LocationError);
    expect(error.code).toBe('mock_location');
  });

  it('pide el permiso si todavía no se concedió y sigue si lo conceden', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });

    await expect(captureLocation()).resolves.toBeDefined();
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('falla con permission_denied si el usuario deniega el permiso', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    requestPermissions.mockResolvedValue({ granted: false });

    expect((await errorOf(captureLocation())).code).toBe('permission_denied');
  });

  it('no vuelve a pedir el permiso si ya no se puede', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

    expect((await errorOf(captureLocation())).code).toBe('permission_denied');
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('falla con services_disabled si el GPS está apagado', async () => {
    servicesEnabled.mockResolvedValue(false);

    expect((await errorOf(captureLocation())).code).toBe('services_disabled');
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('falla con no_fix si el proveedor no consigue posición', async () => {
    getPosition.mockRejectedValue(new Error('Location request timed out'));

    expect((await errorOf(captureLocation())).code).toBe('no_fix');
  });

  it('falla con no_fix si el proveedor no responde a tiempo', async () => {
    jest.useFakeTimers();
    try {
      getPosition.mockReturnValue(new Promise(() => {}));

      const pending = errorOf(captureLocation());
      await jest.advanceTimersByTimeAsync(FIX_TIMEOUT_MS);

      expect((await pending).code).toBe('no_fix');
    } finally {
      jest.useRealTimers();
    }
  });

  it('falla con no_fix si la lectura no informa la precisión', async () => {
    getPosition.mockResolvedValue(position({ accuracy: null }));

    expect((await errorOf(captureLocation())).code).toBe('no_fix');
  });
});
