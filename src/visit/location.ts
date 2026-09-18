import * as Location from 'expo-location';

/** Por qué no se pudo obtener una ubicación utilizable. */
export type LocationErrorCode =
  | 'permission_denied'
  | 'services_disabled'
  | 'mock_location'
  | 'no_fix';

/** Error al capturar la ubicación. Lleva un código estable para que la UI elija el mensaje. */
export class LocationError extends Error {
  constructor(
    message: string,
    readonly code: LocationErrorCode,
  ) {
    super(message);
    this.name = 'LocationError';
  }
}

/** Ubicación capturada al iniciar una visita. */
export interface VisitLocation {
  latitude: number;
  longitude: number;
  /** Radio de incertidumbre de la lectura, en metros. */
  accuracyMeters: number;
  /** Hora del reloj del dispositivo al capturar, en milisegundos desde epoch. */
  capturedAt: number;
}

/**
 * Captura la ubicación actual del dispositivo para acreditar la presencia en una visita.
 *
 * Rechaza la lectura si Android la marca como simulada (`mocked`): es la señal que da el sistema
 * cuando hay una app de ubicación falsa. Es una defensa parcial: en iOS ese dato no existe y un
 * dispositivo con root puede ocultarlo, así que el servidor no debe tratarlo como prueba absoluta.
 *
 * @throws {LocationError} con el código que explica por qué no se pudo.
 */
export async function captureLocation(): Promise<VisitLocation> {
  const granted = await ensureForegroundPermission();
  if (!granted) {
    throw new LocationError('Falta el permiso de ubicación.', 'permission_denied');
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError('El GPS del dispositivo está apagado.', 'services_disabled');
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new LocationError('No se pudo obtener la posición.', 'no_fix');
  }

  if (position.mocked === true) {
    throw new LocationError('La ubicación es simulada y no se acepta.', 'mock_location');
  }

  const { latitude, longitude, accuracy } = position.coords;
  if (accuracy === null || accuracy === undefined) {
    // Sin radio de incertidumbre no se puede calificar la lectura.
    throw new LocationError('La lectura no informa su precisión.', 'no_fix');
  }

  return { latitude, longitude, accuracyMeters: accuracy, capturedAt: Date.now() };
}

async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain) {
    return false;
  }
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}
