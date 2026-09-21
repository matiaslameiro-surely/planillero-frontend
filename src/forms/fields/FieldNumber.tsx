import { TextInput, View, Text, StyleSheet } from 'react-native';
import type { FormFieldProps } from '../types';

export function FieldNumber({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  const isInteger = schema.type === 'integer';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _minimum = schema.minimum ?? schema.exclusiveMinimum;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _maximum = schema.maximum ?? schema.exclusiveMaximum;

  const sanitize = (text: string) => {
    if (isInteger) {
      return text.replace(/[^0-9-]/g, '');
    }
    return text.replace(/[^0-9.-]/g, '');
  };

  const handleChangeText = (text: string) => {
    const clean = sanitize(text);
    // Solo enviar si es número válido o vacío
    if (clean === '' || clean === '-' || (isInteger ? /^-?\d+$/.test(clean) : /^-?\d*\.?\d*$/.test(clean))) {
      onChange(name, clean === '' || clean === '-' ? undefined : isInteger ? parseInt(clean, 10) : parseFloat(clean));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, required && styles.required]}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={value ?? ''}
        onChangeText={handleChangeText}
        onBlur={() => onBlur(name)}
        editable={!readonly}
        keyboardType={isInteger ? 'numeric' : 'decimal-pad'}
        placeholder={description}
      />
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#1a1a1a' },
  required: { color: '#e53e3e' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  error: { marginTop: 4, fontSize: 12, color: '#e53e3e' },
});