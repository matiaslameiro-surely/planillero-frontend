import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import Login from '@/app/login';

// El prefijo `mock` es lo que permite que el factory de `jest.mock` los referencie: el plugin de
// hoisting de Babel sólo deja pasar variables fuera de scope que lo llevan.
const mockSignIn = jest.fn();
const mockConfirmTwoFactor = jest.fn();
const mockSignOut = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
}));

jest.mock('@/auth/SessionContext', () => ({
  useSession: () => ({
    status: 'signedOut',
    user: null,
    signIn: mockSignIn,
    confirmTwoFactor: mockConfirmTwoFactor,
    signOut: mockSignOut,
  }),
}));

function renderLogin() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Login />);
  });
  return renderer;
}

/** `onPress` del botón devuelve `void`, así que hay que dejar que las promesas pendientes resuelvan. */
async function press(renderer: ReturnType<typeof create>, accessibilityLabel: string) {
  const button = renderer.root.findByProps({ accessibilityLabel });
  await act(async () => {
    button.props.onPress();
    await new Promise((resolve) => setImmediate(resolve));
  });
}

describe('Login: teclado (PLAN-55)', () => {
  let dismiss: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  });

  afterEach(() => {
    dismiss.mockRestore();
  });

  it('envuelve la pantalla en KeyboardAvoidingView con el ajuste correcto según la plataforma', () => {
    const renderer = renderLogin();
    const avoiding = renderer.root.findByType(KeyboardAvoidingView);

    // En Android la ventana ya se achica por `adjustResize`; pedir padding ahí sumaría un segundo
    // desplazamiento. En iOS no hay `adjustResize` y el padding es lo único que corre el contenido.
    expect(avoiding.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : undefined);
  });

  it('permite scrollear el contenido y no se come el primer toque sobre Entrar', () => {
    const renderer = renderLogin();
    const scroll = renderer.root.findByType(ScrollView);

    // Sin esto, el primer toque sobre el botón sólo cerraría el teclado y el usuario tendría que
    // tocar dos veces para entrar.
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('centra el contenido cuando hay lugar y lo deja scrolleable cuando no', () => {
    const renderer = renderLogin();
    const scroll = renderer.root.findByType(ScrollView);
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);

    // `flexGrow: 1` es lo que hace que el centrado y el scroll convivan: el contenedor mide
    // `max(contenido, viewport)`. Sin él, `justifyContent: 'center'` centraría sobre la altura del
    // contenido y el tope quedaría fuera de la pantalla, sin forma de alcanzarlo.
    expect(content.flexGrow).toBe(1);
    expect(content.justifyContent).toBe('center');
  });

  it('deja el botón de entrada dentro del contenido scrolleable', () => {
    const renderer = renderLogin();
    const scroll = renderer.root.findByType(ScrollView);

    // Si el botón quedara fuera del ScrollView, ningún ajuste de teclado lo alcanzaría.
    expect(scroll.findByProps({ accessibilityLabel: 'Entrar a Planillero' })).toBeTruthy();
  });

  it('cierra el teclado cuando la autenticación falla, para no tapar el mensaje de error', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('No se pudo iniciar sesión.'));

    const renderer = renderLogin();
    await press(renderer, 'Entrar a Planillero');

    expect(dismiss).toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain('No se pudo iniciar sesión.');
  });

  it('cierra el teclado también al pasar al paso de código de 2FA', async () => {
    mockSignIn.mockResolvedValueOnce({ twoFactorRequired: true });

    const renderer = renderLogin();
    await press(renderer, 'Entrar a Planillero');

    // El campo de contraseña se desmonta con el foco puesto: sin esto el teclado heredado
    // taparía el campo de código nuevo.
    expect(dismiss).toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Código de verificación de 6 dígitos' }),
    ).toBeTruthy();
  });
});
