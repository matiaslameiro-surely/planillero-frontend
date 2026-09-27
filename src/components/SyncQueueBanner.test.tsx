import { StyleSheet, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { SyncQueueBanner } from '@/components/SyncQueueBanner';
import { contrastRatio } from '@/constants/contrast';

/** Todo el texto visible del cartel, para poder afirmar sobre lo que ve el operador. */
function render(props: Parameters<typeof SyncQueueBanner>[0]): string {
  let renderer!: ReturnType<typeof create>;
  // `create` de react-test-renderer 19 necesita `act` para que el render termine antes de leer.
  act(() => {
    renderer = create(<SyncQueueBanner {...props} />);
  });
  return JSON.stringify(renderer.toJSON());
}

function renderBanner(props: Parameters<typeof SyncQueueBanner>[0]) {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<SyncQueueBanner {...props} />);
  });
  return {
    root: renderer.root,
    json: JSON.stringify(renderer.toJSON()),
  };
}

const base = { pending: 0, failed: 0, justCleared: false, dispatching: false };

describe('SyncQueueBanner', () => {
  it('sin nada pendiente ni recién vaciado no ocupa lugar en la pantalla', () => {
    expect(render(base)).toBe('null');
  });

  it('muestra cuántas actas esperan, con el texto exacto que pide la tarea', () => {
    expect(render({ ...base, pending: 3 })).toContain('Cola de sincronización: 3 actas pendientes');
  });

  it('con una sola acta no dice «1 actas»', () => {
    const text = render({ ...base, pending: 1 });

    expect(text).toContain('Cola de sincronización: 1 acta pendiente');
    expect(text).not.toContain('1 actas');
  });

  it('al vaciarse confirma, en vez de desaparecer en silencio', () => {
    // El silencio no sirve como confirmación: es indistinguible del silencio de que algo falló.
    expect(render({ ...base, justCleared: true })).toContain('Todo sincronizado');
  });

  it('avisa de las actas rechazadas para que no se pierdan sin que nadie se entere', () => {
    expect(render({ ...base, failed: 2 })).toContain('2 actas no pudieron enviarse');
  });

  it('muestra pendientes y rechazadas a la vez', () => {
    const text = render({ ...base, pending: 2, failed: 1, dispatching: true });

    expect(text).toContain('Cola de sincronización: 2 actas pendientes');
    expect(text).toContain('1 acta no pudo enviarse');
  });

  it('el estado se dice con texto y no sólo con color', () => {
    // La tablet se usa al sol, y no todo el mundo distingue colores.
    expect(render({ ...base, pending: 2 })).toContain('pendientes');
  });

  it('el mensaje «✓ Todo sincronizado» tiene un contraste de al menos 4.5:1 entre el texto y su fondo (PLAN-67)', () => {
    const { root } = renderBanner({ ...base, justCleared: true });
    const textNode = root.findAllByType(Text).find((t) => t.props.children === '✓ Todo sincronizado')!;
    expect(textNode).toBeDefined();

    const bannerView = root.findByType(View);
    const bannerStyle = StyleSheet.flatten(bannerView.props.style);
    const textStyle = StyleSheet.flatten(textNode.props.style);

    const textColor = textStyle.color as string;
    const bgColor = bannerStyle.backgroundColor as string;

    expect(bgColor).toBe('#15803d');
    expect(contrastRatio(textColor, bgColor)).toBeGreaterThanOrEqual(4.5);
  });
});
