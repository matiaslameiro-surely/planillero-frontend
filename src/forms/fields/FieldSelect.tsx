import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { FormFieldProps } from '../types';

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
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#1a1a1a' },
  required: { color: '#e53e3e' },
  pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e0', borderRadius: 8, backgroundColor: '#fff' },
  picker: { width: '100%', height: 50 },
  pickerItem: { fontSize: 16 },
  error: { marginTop: 4, fontSize: 12, color: '#e53e3e' },
});