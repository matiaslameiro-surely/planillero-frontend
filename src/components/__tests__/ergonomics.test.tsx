import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { MIN_TOUCH_TARGET, HIGH_CONTRAST_COLORS } from '@/constants/layout';
import { VisitCard } from '@/components/VisitCard';
import { SignaturePad } from '@/components/SignaturePad';
import { DynamicForm } from '@/forms/DynamicForm';
import { FieldText } from '@/forms/fields/FieldText';
import { FieldNumber } from '@/forms/fields/FieldNumber';
import { FieldMultiSelect } from '@/forms/fields/FieldMultiSelect';
import { FieldBoolean } from '@/forms/fields/FieldBoolean';
import type { AgendaVisit } from '@/agenda/agendaRepository';

describe('Ergonomics and Field Accessibility Standards (PLAN-16)', () => {
  it('enforces minimum touch target of at least 48 dp for field gloves operation', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
  });

  it('provides high contrast palette tokens for direct sunlight readability', () => {
    expect(HIGH_CONTRAST_COLORS.textPrimary).toBe('#0f172a');
    expect(HIGH_CONTRAST_COLORS.borderStrong).toBe('#94a3b8');
  });

  it('VisitCard renders start button with accessibility attributes and touch dimensions', () => {
    const mockVisit: AgendaVisit = {
      visitId: 'v-123',
      routeDate: '2026-11-01',
      position: 1,
      code: 'VIS-2026-001',
      address: 'Calle Ficticia 123',
      latitude: -34.5,
      longitude: -58.4,
      urgency: 'HIGH',
      status: 'ASSIGNED',
      start: null,
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <VisitCard
          visit={mockVisit}
          online={true}
          starting={false}
          onStart={jest.fn()}
        />,
      );
    });

    const startBtn = renderer.root.findByProps({ accessibilityLabel: 'Iniciar visita VIS-2026-001' });
    expect(startBtn).toBeTruthy();
    const style = StyleSheet.flatten(
      typeof startBtn.props.style === 'function'
        ? startBtn.props.style({ pressed: false })
        : startBtn.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('SignaturePad renders ergonomic buttons with accessibility roles and labels', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SignaturePad onSave={jest.fn()} onCancel={jest.fn()} />);
    });

    const labels = [
      'Limpiar trazo de firma',
      'Cancelar captura de firma',
      'Confirmar y guardar firma',
    ];

    for (const label of labels) {
      const btn = renderer.root.findByProps({ accessibilityLabel: label });
      expect(btn).toBeTruthy();
      const style = StyleSheet.flatten(btn.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it('DynamicForm renders submit button with accessible target size', () => {
    const schema = {
      type: 'object',
      properties: {
        nombre: { type: 'string', title: 'Nombre Operador' },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <DynamicForm
          schema={schema}
          onSubmit={jest.fn()}
          submitLabel="Enviar acta"
        />,
      );
    });

    const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Enviar acta' });
    expect(submitBtn).toBeTruthy();
    const style = StyleSheet.flatten(submitBtn.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('FieldText renders input with accessibilityLabel and minHeight', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FieldText
          name="notes"
          schema={{ type: 'string' }}
          value=""
          onChange={jest.fn()}
          onBlur={jest.fn()}
          label="Observaciones de Campo"
        />,
      );
    });

    const input = renderer.root.findByProps({ accessibilityLabel: 'Observaciones de Campo' });
    expect(input).toBeTruthy();
    const style = StyleSheet.flatten(input.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('FieldNumber renders input with accessibilityLabel and minHeight', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FieldNumber
          name="medidor"
          schema={{ type: 'integer' }}
          value={123}
          onChange={jest.fn()}
          onBlur={jest.fn()}
          label="Lectura Medidor"
        />,
      );
    });

    const input = renderer.root.findByProps({ accessibilityLabel: 'Lectura Medidor' });
    expect(input).toBeTruthy();
    const style = StyleSheet.flatten(input.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('FieldMultiSelect renders interactive chips with checkbox role and minHeight', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FieldMultiSelect
          name="anomalias"
          schema={{
            type: 'array',
            items: { enum: ['Fuga', 'Rotura'] },
          }}
          value={['Fuga']}
          onChange={jest.fn()}
          onBlur={jest.fn()}
          label="Anomalías detectadas"
        />,
      );
    });

    const chipFuga = renderer.root.findByProps({ accessibilityLabel: 'Anomalías detectadas: Fuga' });
    const chipRotura = renderer.root.findByProps({ accessibilityLabel: 'Anomalías detectadas: Rotura' });

    expect(chipFuga).toBeTruthy();
    expect(chipRotura).toBeTruthy();

    const styleFuga = StyleSheet.flatten(chipFuga.props.style);
    const styleRotura = StyleSheet.flatten(chipRotura.props.style);

    expect(styleFuga.minHeight).toBeGreaterThanOrEqual(48);
    expect(styleRotura.minHeight).toBeGreaterThanOrEqual(48);
    expect(chipFuga.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(chipRotura.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
  });

  it('FieldBoolean renders switch with accessibility role and label', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FieldBoolean
          name="aprobado"
          schema={{ type: 'boolean' }}
          value={true}
          onChange={jest.fn()}
          onBlur={jest.fn()}
          label="Cumple requisitos"
        />,
      );
    });

    const switchComponent = renderer.root.findByProps({ accessibilityRole: 'switch' });
    expect(switchComponent).toBeTruthy();
    expect(switchComponent.props.accessibilityLabel).toBe('Cumple requisitos');
  });
});
