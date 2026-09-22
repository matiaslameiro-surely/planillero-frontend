import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { JsonSchema, FormFieldProps, FormMode } from './types';
import { renderField } from './fields';
import { validateSchema, validateField } from './validation';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

interface DynamicFormProps {
  /** JSON Schema completo del formulario. */
  schema: JsonSchema;
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
    const fieldSchema = properties[name] as JsonSchema | undefined;
    if (fieldSchema) {
      const fieldError = validateField({ ...schema, properties: { [name]: fieldSchema } } as JsonSchema, name, values[name]);
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
        const fieldSchema = properties[name] as JsonSchema;
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
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isValid || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isValid || submitting}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !isValid || submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" style={styles.spinner} />
            ) : (
              <Text style={styles.submitButtonText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  buttonRow: { alignItems: 'stretch', marginTop: 24 },
  submitButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  spinner: { marginLeft: 8 },
});