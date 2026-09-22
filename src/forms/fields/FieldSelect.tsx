import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { FormFieldProps } from '../types';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

export function FieldSelect({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  const enumValues = (schema.enum as string[]) ?? [];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, required && styles.required]}>{label}{required ? ' *' : ''}</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={value as string ?? ''}
          onValueChange={(itemValue) => onChange(name, itemValue)}
          onBlur={() => onBlur(name)}
          enabled={!readonly}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          accessibilityLabel={label}
        >
          <Picker.Item label={description ?? 'Seleccionar...'} value="" />
          {enumValues.map((v) => (
            <Picker.Item key={v} label={v} value={v} />
          ))}
        </Picker>
      </View>
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#0f172a' },
  required: { color: '#b91c1c' },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  picker: { width: '100%', minHeight: MIN_TOUCH_TARGET },
  pickerItem: { fontSize: 16, color: '#0f172a' },
  error: { marginTop: 4, fontSize: 12, color: '#b91c1c', fontWeight: '600' },
});