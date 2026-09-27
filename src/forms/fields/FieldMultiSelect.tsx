import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { FormFieldProps, JsonSchema } from '../types';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

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
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      {description && <Text style={styles.description}>{description}</Text>}
      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
        {enumValues.map((v) => {
          const isChecked = selected.includes(v);
          return (
            <TouchableOpacity
              key={v}
              onPress={() => toggle(v)}
              disabled={readonly}
              accessibilityRole="checkbox"
              accessibilityLabel={`${label}: ${v}`}
              accessibilityState={{ checked: isChecked, disabled: readonly }}
              style={[
                styles.chip,
                isChecked ? styles.chipSelected : styles.chipUnselected,
              ]}
            >
              <Text style={[
                styles.chipText,
                isChecked ? styles.chipTextSelected : styles.chipTextUnselected,
              ]}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {touched && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#0f172a' },
  requiredAsterisk: { color: '#b91c1c' },
  description: { fontSize: 12, color: '#475569', marginBottom: 8 },
  chipsContainer: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipUnselected: { backgroundColor: '#ffffff', borderColor: '#94a3b8' },
  chipText: { fontSize: 14, fontWeight: '700' },
  chipTextSelected: { color: '#ffffff' },
  chipTextUnselected: { color: '#1e293b' },
  error: { marginTop: 4, fontSize: 12, color: '#b91c1c', fontWeight: '600' },
});