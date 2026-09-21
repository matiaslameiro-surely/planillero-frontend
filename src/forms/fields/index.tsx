import { JSONSchema7 } from 'ajv';
import type { FormFieldProps } from '../types';
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

/** Mapa de tipo JSON Schema -> componente de renderizado. */
export function getFieldComponent(schema: JSONSchema7) {
  const type = schema.type;
  const isEnum = Array.isArray(schema.enum) && schema.enum.length > 0;
  const isArray = type === 'array';
  const itemType = schema.items?.type;

  // string + enum -> select único
  if (type === 'string' && isEnum) return FieldSelect;

  // array de strings con enum -> multi-select (checkboxes)
  if (isArray && itemType === 'string' && Array.isArray(schema.items?.enum)) return FieldMultiSelect;

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