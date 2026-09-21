import { useState, useCallback, useEffect } from 'react';
import type { JsonSchema } from './types';
import { validateSchema, validateField } from './validation';

interface UseFormOptions {
  /** Schema JSON Schema completo. */
  schema: JsonSchema;
  /** Valores iniciales. */
  initialValues?: Record<string, unknown>;
  /** Callback de envío. */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

export function useForm({ schema, initialValues = {}, onSubmit }: UseFormOptions) {
  const [values, setValuesState] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const key of Object.keys(initialValues)) {
      if (initialValues[key] !== undefined) v[key] = initialValues[key];
    }
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValid, setIsValid] = useState(false);

  // Validación completa cuando cambian values o schema
  const runValidation = useCallback((vals: Record<string, unknown>) => {
    const result = validateSchema(schema, vals);
    return result;
  }, [schema]);

  useEffect(() => {
    runValidation(values);
  }, [values, runValidation]);

  const handleChange = (name: string, value: unknown) => {
    setValuesState((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (name: string) => {
    const fieldSchema = schema.properties?.[name];
    if (!fieldSchema) return;
    const fieldError = validateField({ 
      ...schema, 
      properties: { [name]: fieldSchema as { type?: string; title?: string; description?: string; enum?: readonly unknown[] } } 
    } as import('./types').JsonSchema, name, values[name]);
    setErrors((prev) => ({ ...prev, [name]: fieldError ?? '' }));
  };

  const handleSubmit = async () => {
    // Marcar todos como touched
    Object.keys(schema.properties ?? {}).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    // setTouched(allTouched); // opcional: mostrar todos los errores al intentar enviar

    const result = validateSchema(schema, values);
    // setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await onSubmit(values);
    } catch (e) {
      console.error('Form submit error:', e);
      throw e;
    }
  };

  const reset = () => {
    const v: Record<string, unknown> = {};
    for (const key of Object.keys(schema.properties ?? {})) {
      if (initialValues[key] !== undefined) v[key] = initialValues[key];
    }
    setValuesState(v);
    setErrors({});
    setTouched({});
    setIsValid(false);
  };

  const setValue = (name: string, value: unknown) => {
    setValuesState((prev) => ({ ...prev, [name]: value }));
  };

  const setValues = (newValues: Record<string, unknown>) => {
    setValuesState(newValues);
  };

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting: false, // se maneja externamente
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValue,
    setValues,
  };
}