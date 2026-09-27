import { View, Text, StyleSheet, Switch } from 'react-native';
import type { FormFieldProps } from '../types';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

export function FieldBoolean({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelWrapper}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
        <Switch
          value={value as boolean ?? false}
          onValueChange={(v) => onChange(name, v)}
          onBlur={() => onBlur(name)}
          disabled={readonly}
          trackColor={{ false: '#cbd5e1', true: '#1d4ed8' }}
          thumbColor={value ? '#ffffff' : '#f8fafc'}
          accessibilityLabel={label}
          accessibilityRole="switch"
        />
      </View>
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  labelWrapper: { flex: 1, paddingRight: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  requiredAsterisk: { color: '#b91c1c' },
  description: { fontSize: 12, color: '#475569', marginTop: 2 },
  error: { marginTop: 4, fontSize: 12, color: '#b91c1c', fontWeight: '600' },
});