import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import { router, useLocalSearchParams } from 'expo-router';

import FormularioScreen from '@/app/formulario';
import { fetchTemplate } from '@/forms/api';
import { submitForm } from '@/api/visits';
import { MIN_TOUCH_TARGET } from '@/constants/layout';
import type { FormTemplateDetail } from '@/forms/types';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/forms/api', () => ({
  fetchTemplate: jest.fn(),
}));

jest.mock('@/api/visits', () => ({
  submitForm: jest.fn(),
}));

const mockTemplate: FormTemplateDetail = {
  id: 'aaaaaaaa-0001-4000-8000-000000000002',
  key: 'mantenimiento-general',
  version: 2,
  name: 'Mantenimiento general',
  description: 'Parte de mantenimiento',
  createdAt: '2026-09-27T10:00:00Z',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Mantenimiento general',
    type: 'object',
    additionalProperties: false,
    required: ['workedHours', 'taskType'],
    properties: {
      workedHours: {
        title: 'Horas trabajadas',
        type: 'number',
        minimum: 0,
        maximum: 24,
      },
      taskType: {
        title: 'Tipo de tarea',
        type: 'string',
        enum: ['PREVENTIVO', 'CORRECTIVO', 'INSPECCION'],
      },
      observations: {
        title: 'Observaciones',
        type: 'string',
        maxLength: 500,
      },
    },
  },
};

describe('FormularioScreen (PLAN-81)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      visitId: 'visit-123',
      templateKey: 'mantenimiento-general',
      templateVersion: '2',
    });
    (fetchTemplate as jest.Mock).mockResolvedValue(mockTemplate);
    (submitForm as jest.Mock).mockResolvedValue({
      visitId: 'visit-123',
      templateKey: 'mantenimiento-general',
      templateVersion: 2,
      submittedAt: '2026-09-27T12:00:00Z',
    });
  });

  it('renders loading state initially and then renders header with back button and form', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FormularioScreen />);
    });

    expect(fetchTemplate).toHaveBeenCalledWith('mantenimiento-general', 2);

    const backBtn = renderer.root.findByProps({
      accessibilityLabel: 'Volver a la pantalla anterior',
    });
    expect(backBtn).toBeTruthy();
    expect(backBtn.props.accessibilityRole).toBe('button');

    const backBtnStyle = StyleSheet.flatten(backBtn.props.style);
    expect(backBtnStyle.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

    const submitBtn = renderer.root.findByProps({
      accessibilityLabel: 'Enviar formulario',
    });
    expect(submitBtn).toBeTruthy();
  });

  it('navigates back when pressing back button in header', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FormularioScreen />);
    });

    const backBtn = renderer.root.findByProps({
      accessibilityLabel: 'Volver a la pantalla anterior',
    });

    act(() => {
      backBtn.props.onPress();
    });

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('submits valid form data to submitForm and navigates back on success', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FormularioScreen />);
    });

    // Fill workedHours (number)
    const hoursInput = renderer.root.findByProps({
      accessibilityLabel: 'Horas trabajadas',
    });
    act(() => {
      hoursInput.props.onChangeText('4');
    });

    // Fill taskType (select)
    const typeSelect = renderer.root.findByProps({
      accessibilityLabel: 'Tipo de tarea',
    });
    act(() => {
      typeSelect.props.onValueChange('PREVENTIVO');
    });

    // Press submit
    const submitBtn = renderer.root.findByProps({
      accessibilityLabel: 'Enviar formulario',
    });

    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(submitForm).toHaveBeenCalledWith('visit-123', {
      templateKey: 'mantenimiento-general',
      templateVersion: 2,
      responses: {
        workedHours: 4,
        taskType: 'PREVENTIVO',
      },
    });

    expect(Alert.alert).toHaveBeenCalledWith('Éxito', 'Formulario enviado correctamente');
    expect(router.back).toHaveBeenCalled();
  });

  it('renders required field label without coloring the full text in red', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FormularioScreen />);
    });

    // Verify labels in the tree
    const textNodes = renderer.root.findAllByType('Text' as any);
    const labelNode = textNodes.find(
      (node) => node.children && node.children.includes('Horas trabajadas'),
    );
    expect(labelNode).toBeTruthy();
    // The main label text style shouldn't be the required red color
    expect(labelNode?.props.style?.color).toBe('#0f172a');
  });
});
