import { TextInput, View, Text, StyleSheet } from 'react-native';
import type { FormFieldProps } from '../types';

export function FieldText({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  const maxLength = schema.maxLength;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _pattern = schema.pattern ? new RegExp(schema.pattern) : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, required && styles.required]}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={value as string ?? ''}
        onChangeText={(text) => onChange(name, text)}
        onBlur={() => onBlur(name)}
        editable={!readonly}
        maxLength={maxLength}
        placeholder={description}
        // Validación visual al escribir si hay pattern
        // Nota: la validación real se hace en useForm/validation.ts
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