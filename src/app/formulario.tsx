import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { DynamicForm } from '@/forms/DynamicForm';
import { useForm } from '@/forms/useForm';
import { fetchTemplate } from '@/forms/api';
import { submitForm } from '@/api/visits';
import type { JsonSchema } from '@/forms/types';


export default function FormularioScreen() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();

  const [schema, setSchema] = React.useState<JsonSchema | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [templateKey, setTemplateKey] = React.useState<string | null>(null);
  const [templateVersion, setTemplateVersion] = React.useState<number | null>(null);

  // Cargar schema al montar
  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Si hay visitId, intentar obtener la plantilla de la visita
        // Por ahora asumimos que viene templateKey por query param o se elige de catálogo
        const params = new URLSearchParams(window.location.search);
        const tplKey = params.get('templateKey');
        const tplVersion = params.get('templateVersion');

        if (tplKey) {
          const tpl = await fetchTemplate(tplKey, tplVersion ? parseInt(tplVersion, 10) : undefined);
          setSchema(tpl.schema);
          setTemplateKey(tpl.key);
          setTemplateVersion(tpl.version);
        } else {
          // TODO: mostrar catálogo para elegir
          setError('No se especificó plantilla');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar formulario');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [visitId]);

  const { handleSubmit } = useForm({
    schema: schema ?? { type: 'object', properties: {}, required: [] },
    initialValues: {},
    onSubmit: async (vals) => {
      if (!visitId || !templateKey || !templateVersion) {
        Alert.alert('Error', 'Faltan datos de visita o plantilla');
        return;
      }
      await submitForm(visitId, {
        templateKey: templateKey!,
        templateVersion: templateVersion!,
        responses: vals,
      });
      Alert.alert('Éxito', 'Formulario enviado correctamente');
      router.back();
    },
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Cargando formulario...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!schema) {
    return (
      <View style={styles.center}>
        <Text>Formulario no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DynamicForm
        schema={schema}
        mode="edit"
        onSubmit={handleSubmit}
        submitLabel="Enviar formulario"
        submitting={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  error: { color: '#e53e3e', textAlign: 'center', margin: 16 },
});