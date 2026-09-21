import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { FormFieldProps, JsonSchema } from '../types';

export function FieldMultiSelect({ name, schema, value, onChange, onBlur, error, touched, readonly, label, description, required }: FormFieldProps) {
  const itemsSchema = schema.items as JsonSchema | undefined;
  const enumValues = (itemsSchema?.enum as string[]) ?? [];
  const selected = (value as string[]) ?? [];

  const toggle = (item: string) => {
    if (readonly) return;
    const next = selected.includes(item)
      ? selected.filter((v) => v !== item)
      : [...selected, item];
    onChange(name, next);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, required && styles.required]}>{label}{required ? ' *' : ''}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
        {enumValues.map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => toggle(v)}
            disabled={readonly}
            style={[
              styles.chip,
              selected.includes(v) ? styles.chipSelected : styles.chipUnselected,
            ]}
          >
            <Text style={[
              styles.chipText,
              selected.includes(v) ? styles.chipTextSelected : styles.chipTextUnselected,
            ]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#1a1a1a' },
  required: { color: '#e53e3e' },
  description: { fontSize: 12, color: '#718096', marginBottom: 8 },
  chipsContainer: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipSelected: { backgroundColor: '#2b6cb0', borderColor: '#2b6cb0' },
  chipUnselected: { backgroundColor: '#fff', borderColor: '#cbd5e0' },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  chipTextUnselected: { color: '#2b6cb0' },
  error: { marginTop: 4, fontSize: 12, color: '#e53e3e' },
});