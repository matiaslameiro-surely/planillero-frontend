import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import type { AgendaVisit } from '@/agenda/agendaRepository';
import { MIN_TOUCH_TARGET, VisitCard } from '@/components/VisitCard';

const assigned: AgendaVisit = {
  visitId: 'v-1',
  routeDate: '2026-11-01',
  position: 1,
  code: 'V-1001',
  address: 'Calle Ficticia 1',
  latitude: -34.5,
  longitude: -58.4,
  status: 'ASSIGNED',
  urgency: 'HIGH',
  start: null,
};

function render(visit: AgendaVisit, options: { online?: boolean; starting?: boolean } = {}) {
  const onStart = jest.fn();
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <VisitCard
        visit={visit}
        online={options.online ?? true}
        starting={options.starting ?? false}
        onStart={onStart}
      />,
    );
  });
  const buttons = renderer.root.findAll((node) => node.props.accessibilityRole === 'button');
  return { renderer, onStart, button: buttons[0], json: JSON.stringify(renderer.toJSON()) };
}

describe('VisitCard', () => {
  it('muestra código, dirección, urgencia y estado', () => {
    const { json } = render(assigned);

    expect(json).toContain('V-1001');
    expect(json).toContain('Calle Ficticia 1');
    expect(json).toContain('Urgencia alta');
    expect(json).toContain('Asignada');
  });

  it('el botón Iniciar visita mide al menos 48 dp y responde al toque', () => {
    const { button, onStart } = render(assigned);

    // La regla vive en el estilo del botón: se lee desde ahí, no de una copia del número.
    const style = StyleSheet.flatten(
      typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);

    act(() => button.props.onPress());
    expect(onStart).toHaveBeenCalledWith(assigned);
  });

  it('sin conexión deshabilita el botón y explica por qué', () => {
    const { button, json } = render(assigned, { online: false });

    expect(button.props.disabled).toBe(true);
    expect(json).toContain('requiere conexión');
  });

  it('mientras se inicia, el botón queda deshabilitado', () => {
    const { button } = render(assigned, { starting: true });

    expect(button.props.disabled).toBe(true);
  });

  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)(
    'una visita %s no ofrece iniciarla',
    (status) => {
      const { button } = render({ ...assigned, status });

      expect(button).toBeUndefined();
    },
  );

  it('una visita en curso iniciada desde este dispositivo muestra la ubicación registrada', () => {
    const { json } = render({
      ...assigned,
      status: 'IN_PROGRESS',
      start: {
        latitude: -34.603712,
        longitude: -58.381593,
        accuracyMeters: 8,
        startedAt: '2026-11-01T15:00:00Z',
      },
    });

    expect(json).toContain('-34.603712');
    expect(json).toContain('Precisión buena');
  });

  it('una visita en curso sin evidencia local no inventa una ubicación', () => {
    const { json } = render({ ...assigned, status: 'IN_PROGRESS', start: null });

    expect(json).toContain('En curso');
    expect(json).not.toContain('Latitud');
  });
});
