import { useState, useCallback, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ValidationResult } from './types';
import { validateSchema, validateField } from './validation';

interface UseFormOptions {
  /** Schema JSON Schema completo. */
  schema: import('ajv').JSONSchema7;
  /** Valores iniciales. */
  initialValues?: Record<string, unknown>;
  /** Callback de envío. */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

interface UseFormReturn {
  /** Valores actuales del formulario. */
  values: Record<string, unknown>;
  /** Errores de validación (field -> mensaje). */
  errors: Record<string, string>;
  /** Campos tocados. */
  touched: Record<string, boolean>;
  /** true si el formulario es válido. */
  isValid: boolean;
  /** true si hay envío en curso. */
  isSubmitting: boolean;
  /** Maneja cambio de valor. */
  handleChange: (name: string, value: unknown) => void;
  /** Maneja blur (validación inline). */
  handleBlur: (name: string) => void;
  /** Maneja envío del formulario. */
  handleSubmit: () => Promise<void>;
  /** Resetea el formulario a valores iniciales. */
  reset: () => void;
  /** Establece un valor programáticamente. */
  setValue: (name: string, value: unknown) => void;
  /** Establece múltiples valores. */
  setValues: (values: Record<string, unknown>) => void;
}

export function useForm({ schema, initialValues = {}, onSubmit }: UseFormOptions): UseFormReturn {
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
    const fieldError = validateField({ ...schema, properties: { [name]: schema.properties?.[name] } } as any, name, values[name]);
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