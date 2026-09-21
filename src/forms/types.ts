import { JSONSchema7 } from 'ajv';

/** Modo de renderizado del formulario. */
export type FormMode = 'edit' | 'readonly';

/** Props base para cada componente de campo. */
export interface FormFieldProps {
  /** Nombre del campo (clave en el objeto de respuestas). */
  name: string;
  /** Esquema JSON Schema de esta propiedad. */
  schema: JSONSchema7;
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
  /** Etiqueta legible (title del schema o name). */
  label?: string;
  /** Texto de ayuda/placeholder (description del schema). */
  description?: string;
  /** Si el campo es requerido (para marcar con *). */
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

/** Resultado de validación completa del formulario. */
export interface ValidationResult {
  /** true si no hay errores. */
  isValid: boolean;
  /** Mapa fieldPath -> mensaje de error (para mostrar inline). */
  errors: Record<string, string>;
  /** Lista completa de violaciones (para debug/log). */
  violations: ValidationError[];
}

/** Plantilla de formulario (respuesta de GET /api/v1/plantillas). */
export interface FormTemplateListItem {
  id: string;
  templateKey: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
}

/** Plantilla con schema completo (respuesta de GET /api/v1/plantillas/{clave}). */
export interface FormTemplateDetail extends FormTemplateListItem {
  schemaJson: JSONSchema7;
}

/** Request para POST /api/v1/visitas/{id}/formulario. */
export interface FormSubmissionRequest {
  templateKey: string;
  templateVersion: number;
  responses: Record<string, unknown>;
}

/** Response de POST /api/v1/visitas/{id}/formulario. */
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
  responsesJson?: Record<string, unknown>;
  formSubmittedAt?: string;
}