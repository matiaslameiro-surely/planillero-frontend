import { TextInput, View, Text, StyleSheet } from 'react-native';
import type { FormFieldProps } from '../types';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

export function FieldNumber({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  const isInteger = schema.type === 'integer';

  const sanitize = (text: string) => {
    if (isInteger) {
      return text.replace(/[^0-9-]/g, '');
    }
    return text.replace(/[^0-9.-]/g, '');
  };

  const handleChangeText = (text: string) => {
    const clean = sanitize(text);

    // Solo enviar si es número válido o vacío
    if (clean === '' || clean === '-' ||
      (isInteger ? /^-?\d+$/.test(clean) : /^-?\d*\.?\d*$/.test(clean))) {
      const parsed = clean === '' || clean === '-' ? undefined :
        isInteger ? parseInt(clean, 10) : parseFloat(clean);
      onChange(name, parsed);
    }
  };

  const displayValue = value === undefined || value === null ? '' : String(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={displayValue}
        onChangeText={handleChangeText}
        onBlur={() => onBlur(name)}
        editable={!readonly}
        keyboardType={isInteger ? 'numeric' : 'decimal-pad'}
        placeholder={description}
        accessibilityLabel={label}
      />
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#0f172a' },
  requiredAsterisk: { color: '#b91c1c' },
  input: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: MIN_TOUCH_TARGET,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  error: { marginTop: 4, fontSize: 12, color: '#b91c1c', fontWeight: '600' },
});