import { createHash } from 'node:crypto';
import { PanResponder, type PanResponderCallbacks } from 'react-native';
import { act, create } from 'react-test-renderer';

import { SignaturePad } from '@/components/SignaturePad';

/**
 * Se reemplaza `PanResponder.create` para exponer los callbacks tal cual en el lienzo: así el test
 * dibuja un trazo sin simular el historial de toques del sistema de gestos.
 */
beforeEach(() => {
  jest.spyOn(PanResponder, 'create').mockImplementation(
    (config: PanResponderCallbacks) => ({ panHandlers: config }) as unknown as ReturnType<typeof PanResponder.create>,
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

function touch(x: number, y: number) {
  return { nativeEvent: { locationX: x, locationY: y } };
}

/** Dibuja un trazo y confirma la firma; devuelve lo que recibió `onSave`. */
async function signAndConfirm(draw: (canvas: { props: Record<string, (...args: unknown[]) => void> }) => void) {
  const onSave = jest.fn();
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<SignaturePad onSave={onSave} onCancel={jest.fn()} />);
  });

  draw(renderer.root.find((node) => typeof node.props.onPanResponderGrant === 'function'));

  await act(async () => {
    await renderer.root.findByProps({ accessibilityLabel: 'Confirmar y guardar firma' }).props.onPress();
  });

  expect(onSave).toHaveBeenCalledTimes(1);
  return onSave.mock.calls[0][0];
}

describe('SignaturePad (PLAN-78)', () => {
  it('entrega el SVG de la firma con el hash de ese mismo contenido, sin data URI', async () => {
    const signature = await signAndConfirm((canvas) => {
      act(() => canvas.props.onPanResponderGrant(touch(10, 20)));
      act(() => canvas.props.onPanResponderMove(touch(30, 40), {}));
      act(() => canvas.props.onPanResponderRelease());
    });

    const bytes = Buffer.from(signature.content, 'utf8');
    expect(signature.content.startsWith('<svg')).toBe(true);
    expect(signature.content).toContain('M 10.0 20.0 L 30.0 40.0');
    expect(signature.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(signature.size).toBe(bytes.length);
    expect(signature).not.toHaveProperty('dataUri');
  });

  it('no pierde el último trazo si el movimiento y el soltar llegan en el mismo lote', async () => {
    const signature = await signAndConfirm((canvas) => {
      act(() => {
        canvas.props.onPanResponderGrant(touch(10, 20));
        canvas.props.onPanResponderMove(touch(30, 40), {});
        canvas.props.onPanResponderRelease();
      });
    });

    expect(signature.content).toContain('M 10.0 20.0 L 30.0 40.0');
  });
});
