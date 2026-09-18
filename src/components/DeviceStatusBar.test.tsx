import { act, create } from 'react-test-renderer';

import { DeviceStatusBar } from '@/components/DeviceStatusBar';

/** Junta todo el texto visible de la barra, para poder afirmar sobre lo que ve el operador. */
function textOf(props: Parameters<typeof DeviceStatusBar>[0]): string {
  let renderer!: ReturnType<typeof create>;
  // `create` de react-test-renderer 19 necesita `act` para que el render termine antes de leer.
  act(() => {
    renderer = create(<DeviceStatusBar {...props} />);
  });
  return JSON.stringify(renderer.toJSON());
}

const base = { online: true, batteryLevel: 0.82, gps: 'ready' as const, pendingVisits: 3 };

describe('DeviceStatusBar', () => {
  it('muestra el modo conectado', () => {
    const text = textOf(base);

    expect(text).toContain('Modo conectado');
    expect(text).not.toContain('Modo offline');
  });

  it('muestra el modo offline cuando no hay conexión', () => {
    const text = textOf({ ...base, online: false });

    expect(text).toContain('Modo offline');
    expect(text).not.toContain('Modo conectado');
  });

  it('muestra la batería en porcentaje entero', () => {
    expect(textOf({ ...base, batteryLevel: 0.826 })).toContain('Batería 83%');
  });

  it('avisa cuando no se conoce la batería', () => {
    expect(textOf({ ...base, batteryLevel: null })).toContain('Batería sin datos');
  });

  it.each([
    ['ready', 'GPS listo'],
    ['disabled', 'GPS apagado'],
    ['denied', 'GPS sin permiso'],
    ['unknown', 'GPS sin datos'],
  ] as const)('dice el estado del GPS %s', (gps, label) => {
    expect(textOf({ ...base, gps })).toContain(label);
  });

  it('cuenta las visitas pendientes en singular y plural', () => {
    expect(textOf({ ...base, pendingVisits: 1 })).toContain('1 visita pendiente');
    expect(textOf({ ...base, pendingVisits: 0 })).toContain('0 visitas pendientes');
    expect(textOf({ ...base, pendingVisits: 5 })).toContain('5 visitas pendientes');
  });
});
