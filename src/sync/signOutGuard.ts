import { Alert } from 'react-native';

/**
 * Lo que se le dice al operador que quiere cerrar sesión con actas sin enviar.
 *
 * Es una función aparte, y no un texto adentro del diálogo, para poder probar exactamente qué se
 * muestra: es el único aviso entre el trabajo de una jornada y su pérdida.
 */
export function pendingWarning(pending: number): string {
  const actas = pending === 1 ? '1 acta' : `${pending} actas`;
  return (
    `Tenés ${actas} sin sincronizar. Al cerrar sesión se cierra la base local del dispositivo y ` +
    `${pending === 1 ? 'esa acta no se va a enviar' : 'esas actas no se van a enviar'} hasta que ` +
    'vuelvas a entrar. Conectate a una red y esperá a que la cola se vacíe.'
  );
}

/**
 * Pide confirmación antes de cerrar sesión con la cola sin vaciar.
 *
 * Sin operaciones pendientes no pregunta nada: un aviso que aparece siempre se aprende a descartar
 * sin leer, y entonces deja de avisar (Nielsen, heurística 5). Sólo interrumpe cuando hay algo real
 * que perder.
 *
 * La acción destructiva no es la opción por defecto: quien toca fuera del diálogo o vuelve atrás se
 * queda con la sesión abierta y sus actas intactas.
 */
export function confirmSignOut(pending: number): Promise<boolean> {
  if (pending <= 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Hay actas sin sincronizar',
      pendingWarning(pending),
      [
        { text: 'Seguir en sesión', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cerrar sesión igual', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
