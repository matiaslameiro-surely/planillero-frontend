/** JSON Schema (Draft 2020-12): solo las keywords simples que usa el contrato. */
export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: readonly unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  /** En 2020-12 `items` es un único schema: la forma de tupla pasó a `prefixItems` y AJV la rechaza. */
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  required?: string[];
  dependencies?: Record<string, JsonSchema | string[]>;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
};

/** Modo de renderizado del formulario. */
export type FormMode = 'edit' | 'readonly';

/** Props base para cada componente de campo. */
export interface FormFieldProps {
  /** Nombre del campo (clave en el objeto de respuestas). */
  name: string;
  /** Esquema JSON Schema de esta propiedad. */
  schema: JsonSchema;
  /** Valor actual del campo. */
  value: unknown;
  /** Función para notificar cambio de valor. */
  onChange: (name: string, value: unknown) => void;
  /** Función para notificar blur (para validar al salir). */
  onBlur: (name: string) => void;
  /** Error de validación actual (si hay). */
  error?: string;
  /** Si el campo ha sido tocado (para mostrar error solo tras interacción). */
  touched?: boolean;
  /** Si el formulario es de solo lectura. */
  readonly?: boolean;
  /** Etiqueta legible. */
  label?: string;
  /** Texto de ayuda. */
  description?: string;
  /** Si el campo es requerido. */
  required?: boolean;
}

/** Error de validación estructurado. */
export interface ValidationError {
  /** Ruta JSON Pointer al campo (ej. "/workedHours"). */
  field: string;
  /** Mensaje legible para el usuario. */
  message: string;
  /** Valor que causó el error. */
  rejectedValue?: unknown;
}

/** Resultado de validación completa. */
export interface ValidationResult {
  /** true si no hay errores. */
  isValid: boolean;
  /** Mapa fieldPath -> mensaje de error (para mostrar inline). */
  errors: Record<string, string>;
  /** Lista completa de violaciones (para debug/log). */
  violations: ValidationError[];
}

/** Plantilla de formulario (lista). */
export interface FormTemplateListItem {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string;
  createdAt: string;
}

/** Plantilla con schema completo. */
export interface FormTemplateDetail extends FormTemplateListItem {
  schema: JsonSchema;
}

/** Request para enviar formulario. */
export interface FormSubmissionRequest {
  templateKey: string;
  templateVersion: number;
  responses: Record<string, unknown>;
}

/** Response de envío. */
export interface FormSubmissionResponse {
  visitId: string;
  templateKey: string;
  templateVersion: number;
  submittedAt: string;
}

/** Visita con datos de formulario (para backoffice/visor). */
export interface VisitWithForm {
  id: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  jurisdiction: string;
  status: string;
  urgency: string;
  createdAt: string;
  formTemplateId?: string;
  templateKey?: string;
  templateVersion?: number;
  templateName?: string;
  responses?: Record<string, unknown>;
  submittedAt?: string;
}