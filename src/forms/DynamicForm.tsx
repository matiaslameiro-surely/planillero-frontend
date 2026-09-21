import React from 'react';
import { View, Text, StyleSheet, ScrollView, Button, ActivityIndicator } from 'react-native';
import { JSONSchema7 } from 'ajv';
import type { FormFieldProps, FormMode } from '../types';
import { renderField } from './fields';
import { validateSchema, validateField } from './validation';

interface DynamicFormProps {
  /** JSON Schema completo del formulario. */
  schema: JSONSchema7;
  /** Valores actuales del formulario. */
  initialValues?: Record<string, unknown>;
  /** Modo: 'edit' (default) o 'readonly'. */
  mode?: FormMode;
  /** Callback al enviar formulario válido. */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  /** Texto del botón de envío. */
  submitLabel?: string;
  /** Si hay envío en curso. */
  submitting?: boolean;
}

export function DynamicForm({
  schema,
  initialValues = {},
  mode = 'edit',
  onSubmit,
  submitLabel = 'Enviar',
  submitting = false,
}: DynamicFormProps) {
  const properties = schema.properties ?? {};
  const requiredFields = new Set(schema.required ?? []);
  const fieldNames = Object.keys(properties);

  // Estado interno para valores, errores y touched
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const key of fieldNames) {
      if (initialValues[key] !== undefined) v[key] = initialValues[key];
    }
    return v;
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [isValid, setIsValid] = React.useState(false);

  // Validación completa al montar y cuando cambian values
  React.useEffect(() => {
    const result = validateSchema(schema, values);
    setErrors(result.errors);
    setIsValid(result.isValid);
  }, [values, schema]);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    // Validar campo individual al blur
    const fieldSchema = properties[name] as JSONSchema7 | undefined;
    if (fieldSchema) {
      const fieldError = validateField({ ...schema, properties: { [name]: fieldSchema } } as JSONSchema7, name, values[name]);
      setErrors((prev) => ({ ...prev, [name]: fieldError ?? '' }));
    }
  };

  const handleSubmit = async () => {
    // Marcar todos como touched
    const allTouched = fieldNames.reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    // Validar completo
    const result = validateSchema(schema, values);
    setErrors(result.errors);
    if (!result.isValid) return;
    await onSubmit(values);
  };

  if (fieldNames.length === 0) {
    return (
      <View style={styles.empty}>
        <Text>Este formulario no tiene campos definidos.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {fieldNames.map((name) => {
        const fieldSchema = properties[name] as JSONSchema7;
        const fieldProps: FormFieldProps = {
          name,
          schema: fieldSchema,
          value: values[name],
          onChange: handleChange,
          onBlur: handleBlur,
          error: errors[name],
          touched: touched[name],
          readonly: mode === 'readonly',
          label: fieldSchema.title ?? name,
          description: fieldSchema.description,
          required: requiredFields.has(name),
        };
        return <View key={name}>{renderField(fieldProps)}</View>;
      })}
      {mode === 'edit' && (
        <View style={styles.buttonRow}>
          <Button title={submitLabel} onPress={handleSubmit} disabled={!isValid || submitting} color="#2b6cb0" />
          {submitting && <ActivityIndicator style={styles.spinner} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  buttonRow: { alignItems: 'center', gap: 12, marginTop: 24 },
  spinner: { marginLeft: 8 },
});