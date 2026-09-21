import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'ajv';
import type { ValidationError, ValidationResult } from './types';

/** Instancia singleton de AJV con formatos. */
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  coerceTypes: 'array',
});
addFormats(ajv);

/** Caché de funciones de validación compiladas por schema (clave = JSON.stringify(schema)). */
const validateCache = new Map<string, ValidateFunction>();

/**
 * Compila (o recupera de caché) una función de validación para el schema dado.
 * @param schema JSON Schema (Draft 2020-12)
 * @returns Función `validate(data) => boolean`
 */
export function getValidator(schema: JSONSchema7): ValidateFunction {
  const key = JSON.stringify(schema);
  let validate = validateCache.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
    validateCache.set(key, validate);
  }
  return validate;
}

/**
 * Convierte errores de AJV a nuestro formato `ValidationError[]`.
 * @param errors Array de `ErrorObject` de AJV
 * @returns Array de `ValidationError` con field (JSON Pointer) y mensaje legible
 */
export function mapAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors || errors.length === 0) return [];
  return errors.map((e) => ({
    field: e.instancePath || (e.schemaPath ? `#/${e.schemaPath.split('/').slice(1).join('/')}` : ''),
    message: ajvErrorMessage(e),
    rejectedValue: e.data,
  }));
}

/**
 * Genera mensaje de error legible en español según keyword fallida.
 */
function ajvErrorMessage(e: ErrorObject): string {
  const field = e.instancePath.replace('/', '') || 'campo';
  const params = e.params as Record<string, unknown>;

  switch (e.keyword) {
    case 'required':
      return `El campo "${params.missingProperty ?? field}" es obligatorio.`;
    case 'type':
      return `El campo "${field}" debe ser de tipo ${e.params.type}.`;
    case 'enum':
      return `El campo "${field}" debe ser uno de: ${(params.allowedValues as unknown[]).join(', ')}.`;
    case 'minimum':
      return `El campo "${field}" debe ser ≥ ${params.limit}.`;
    case 'maximum':
      return `El campo "${field}" debe ser ≤ ${params.limit}.`;
    case 'exclusiveMinimum':
      return `El campo "${field}" debe ser > ${params.limit}.`;
    case 'exclusiveMaximum':
      return `El campo "${field}" debe ser < ${params.limit}.`;
    case 'minLength':
      return `El campo "${field}" debe tener al menos ${params.limit} caracteres.`;
    case 'maxLength':
      return `El campo "${field}" no puede exceder ${params.limit} caracteres.`;
    case 'pattern':
      return `El campo "${field}" no tiene el formato esperado.`;
    case 'format':
      return `El campo "${field}" no tiene un formato válido (${params.format}).`;
    case 'additionalProperties':
      return `El campo "${params.additionalProperty}" no está permitido.`;
    default:
      return e.message ?? `Valor inválido en "${field}".`;
  }
}

/**
 * Valida un objeto de datos contra un schema.
 * @param schema JSON Schema
 * @param data Datos a validar
 * @returns `ValidationResult` con `isValid`, `errors` (mapa field->mensaje) y `violations`
 */
export function validateSchema(schema: JSONSchema7, data: unknown): ValidationResult {
  const validate = getValidator(schema);
  const valid = validate(data);
  const violations = mapAjvErrors(validate.errors);
  const errors: Record<string, string> = {};
  for (const v of violations) {
    // instancePath viene como "/fieldName" -> quitar la barra inicial
    const key = v.field.startsWith('/') ? v.field.slice(1) : v.field;
    errors[key] = v.message;
  }
  return { isValid: valid, errors, violations };
}

/**
 * Valida un solo campo (para validación inline al cambiar/blur).
 * @param schema Schema completo del formulario
 * @param fieldName Nombre del campo (clave en properties)
 * @param value Valor a validar
 * @returns Mensaje de error o `undefined` si válido
 */
export function validateField(schema: JSONSchema7, fieldName: string, value: unknown): string | undefined {
  // Creamos un schema mínimo solo con esa propiedad para validar rápido
  const fieldSchema = schema.properties?.[fieldName] as JSONSchema7 | undefined;
  if (!fieldSchema) return undefined;

  const validate = getValidator({
    type: 'object',
    properties: { [fieldName]: fieldSchema },
    required: schema.required?.includes(fieldName) ? [fieldName] : [],
    additionalProperties: false,
  });

  const valid = validate({ [fieldName]: value });
  if (valid) return undefined;

  const violations = mapAjvErrors(validate.errors);
  return violations[0]?.message;
}