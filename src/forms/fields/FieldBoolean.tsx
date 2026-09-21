import { View, Text, StyleSheet, Switch } from 'react-native';
import type { FormFieldProps } from '../types';

export function FieldBoolean({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelWrapper}>
          <Text style={[styles.label, required && styles.required]}>{label}{required ? ' *' : ''}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
        <Switch
          value={value as boolean ?? false}
          onValueChange={(v) => onChange(name, v)}
          onBlur={() => onBlur(name)}
          disabled={readonly}
          trackColor={{ false: '#cbd5e0', true: '#2b6cb0' }}
          thumbColor={value ? '#fff' : '#f7fafc'}
        />
      </View>
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelWrapper: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  required: { color: '#e53e3e' },
  description: { fontSize: 12, color: '#718096', marginTop: 2 },
  error: { marginTop: 4, fontSize: 12, color: '#e53e3e' },
});