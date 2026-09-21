import { Alert } from 'react-native';

import { confirmSignOut, pendingWarning } from '@/sync/signOutGuard';

// Se espía `Alert.alert` en vez de reemplazar el módulo entero: mockear `react-native` completo
// rompe el preset de Expo, que necesita el `Platform` real para arrancar.
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

beforeEach(() => {
  alert.mockClear();
});

describe('pendingWarning', () => {
  it('dice cuántas actas se están por perder y qué hacer al respecto', () => {
    const texto = pendingWarning(3);

    expect(texto).toContain('3 actas');
    expect(texto).toContain('Conectate a una red');
  });

  it('con una sola acta no dice «1 actas»', () => {
    expect(pendingWarning(1)).toContain('1 acta sin sincronizar');
  });
});

describe('confirmSignOut', () => {
  it('sin nada pendiente no interrumpe', async () => {
    // Un aviso que aparece siempre se aprende a descartar sin leer, y entonces deja de avisar.
    await expect(confirmSignOut(0)).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it('con actas pendientes pregunta antes de cerrar', async () => {
    const promesa = confirmSignOut(2);

    expect(alert).toHaveBeenCalledTimes(1);
    const [titulo, , botones] = alert.mock.calls[0];
    expect(titulo).toBe('Hay actas sin sincronizar');

    // Confirmar explícitamente sí cierra la sesión.
    botones?.[1]?.onPress?.();
    await expect(promesa).resolves.toBe(true);
  });

  it('cancelar deja la sesión abierta y las actas intactas', async () => {
    const promesa = confirmSignOut(2);

    const botones = alert.mock.calls[0][2];
    botones?.[0]?.onPress?.();

    await expect(promesa).resolves.toBe(false);
  });

  it('la opción destructiva no es la primera ni la de por defecto', async () => {
    void confirmSignOut(2);

    const botones = alert.mock.calls[0][2];
    expect(botones?.[0]?.style).toBe('cancel');
    expect(botones?.[1]?.style).toBe('destructive');
  });

  it('descartar el diálogo equivale a cancelar', async () => {
    const promesa = confirmSignOut(2);

    alert.mock.calls[0][3]?.onDismiss?.();

    await expect(promesa).resolves.toBe(false);
  });
});
