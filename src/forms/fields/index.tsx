import type { JsonSchema, FormFieldProps } from '../types';
import { FieldText } from './FieldText';
import { FieldSelect } from './FieldSelect';
import { FieldMultiSelect } from './FieldMultiSelect';
import { FieldNumber } from './FieldNumber';
import { FieldBoolean } from './FieldBoolean';

export { FieldText } from './FieldText';
export { FieldSelect } from './FieldSelect';
export { FieldMultiSelect } from './FieldMultiSelect';
export { FieldNumber } from './FieldNumber';
export { FieldBoolean } from './FieldBoolean';

function isSchemaWithEnum(schema: JsonSchema | undefined): schema is JsonSchema & { enum: readonly unknown[] } {
  return !!schema && Array.isArray(schema.enum) && schema.enum.length > 0;
}

function isStringArraySchema(schema: JsonSchema | undefined): schema is JsonSchema & { items: JsonSchema & { enum: readonly string[] } } {
  return !!schema && schema.type === 'array' && 
    !!schema.items &&
    schema.items.type === 'string' && Array.isArray(schema.items.enum) && schema.items.enum.length > 0;
}

/** Mapa de tipo JSON Schema -> componente de renderizado. */
export function getFieldComponent(schema: JsonSchema) {
  const type = schema.type;

  // string + enum -> select único
  if (type === 'string' && isSchemaWithEnum(schema)) return FieldSelect;

  // array de strings con enum -> multi-select (checkboxes)
  if (isStringArraySchema(schema)) return FieldMultiSelect;

  // boolean -> switch
  if (type === 'boolean') return FieldBoolean;

  // number / integer -> input numérico
  if (type === 'number' || type === 'integer') return FieldNumber;

  // string por defecto -> text input (con pattern/maxLength manejados en FieldText)
  if (type === 'string') return FieldText;

  // fallback
  return FieldText;
}

/** Helper para renderizar el componente correcto dentro de DynamicForm. */
export function renderField(props: FormFieldProps) {
  const Component = getFieldComponent(props.schema);
  return <Component {...props} />;
}