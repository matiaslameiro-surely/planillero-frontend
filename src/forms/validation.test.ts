import type { JsonSchema } from '@/forms/types';
import { validateField, validateSchema } from '@/forms/validation';

/**
 * Plantilla ficticia con la misma forma que las del seed del backend: declara Draft 2020-12, que es lo
 * que hacía fallar a la clase por defecto de AJV (PLAN-75).
 */
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Mantenimiento general',
  type: 'object',
  additionalProperties: false,
  required: ['workedHours', 'taskType'],
  properties: {
    workedHours: { title: 'Horas trabajadas', type: 'number', minimum: 0, maximum: 24 },
    taskType: { title: 'Tipo de tarea', type: 'string', enum: ['PREVENTIVO', 'CORRECTIVO', 'INSPECCION'] },
    serialNumber: { title: 'Número de serie', type: 'string', pattern: '^[A-Z]{3}-[0-9]{4}$' },
    serviceDate: { title: 'Fecha del servicio', type: 'string', format: 'date' },
  },
} as JsonSchema;

describe('validación de formularios con Draft 2020-12 (PLAN-75)', () => {
  it('compila un schema que declara $schema 2020-12 y acepta datos válidos', () => {
    const result = validateSchema(schema, { workedHours: 8, taskType: 'PREVENTIVO', serialNumber: 'ABC-1234' });

    expect(result.isValid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rechaza datos inválidos con los mensajes en español de cada regla', () => {
    const result = validateSchema(schema, { workedHours: 30, taskType: 'OTRO', extra: 'x' });
    const messages = result.violations.map((v) => v.message);

    expect(result.isValid).toBe(false);
    expect(messages).toEqual(
      expect.arrayContaining([
        'El campo "workedHours" debe ser ≤ 24.',
        'El campo "taskType" debe ser uno de: PREVENTIVO, CORRECTIVO, INSPECCION.',
        'El campo "extra" no está permitido.',
      ]),
    );
  });

  it('informa el requerido faltante', () => {
    const result = validateSchema(schema, { workedHours: 8 });

    expect(result.isValid).toBe(false);
    expect(result.violations.map((v) => v.message)).toContain('El campo "taskType" es obligatorio.');
  });

  it('valida un campo individual del mismo schema', () => {
    expect(validateField(schema, 'serialNumber', 'ABC-1234')).toBeUndefined();
    expect(validateField(schema, 'serialNumber', 'abc')).toBe('El campo "serialNumber" no tiene el formato esperado.');
    expect(validateField(schema, 'taskType', undefined)).toBe('El campo "taskType" es obligatorio.');
  });

  it('aplica los formatos de ajv-formats sobre la instancia 2020-12', () => {
    expect(validateField(schema, 'serviceDate', '2026-09-27')).toBeUndefined();
    expect(validateField(schema, 'serviceDate', '27/09/2026')).toBe(
      'El campo "serviceDate" no tiene un formato válido (date).',
    );
  });
});
