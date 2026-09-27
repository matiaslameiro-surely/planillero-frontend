import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { DynamicForm } from '@/forms/DynamicForm';
import { fetchTemplate } from '@/forms/api';
import { submitForm } from '@/api/visits';
import type { JsonSchema } from '@/forms/types';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

export default function FormularioScreen() {
  const {
    visitId,
    templateKey: paramKey,
    templateVersion: paramVersion,
  } = useLocalSearchParams<{
    visitId?: string;
    templateKey?: string;
    templateVersion?: string;
  }>();

  const [schema, setSchema] = React.useState<JsonSchema | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templateKey, setTemplateKey] = React.useState<string | null>(null);
  const [templateVersion, setTemplateVersion] = React.useState<number | null>(null);

  // Cargar schema al montar
  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Obtener la plantilla de la visita mediante query params nativos de Expo Router
        const tplKey = paramKey ?? (typeof window !== 'undefined' && window.location?.search
          ? new URLSearchParams(window.location.search).get('templateKey')
          : null);
        const rawVersion = paramVersion ?? (typeof window !== 'undefined' && window.location?.search
          ? new URLSearchParams(window.location.search).get('templateVersion')
          : null);

        if (tplKey) {
          const tpl = await fetchTemplate(tplKey, rawVersion ? parseInt(rawVersion, 10) : undefined);
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
  }, [visitId, paramKey, paramVersion]);

  const handleFormSubmit = async (vals: Record<string, unknown>) => {
    if (!visitId || !templateKey || !templateVersion) {
      Alert.alert('Error', 'Faltan datos de visita o plantilla');
      return;
    }
    try {
      setSubmitting(true);
      await submitForm(visitId, {
        templateKey: templateKey!,
        templateVersion: templateVersion!,
        responses: vals,
      });
      Alert.alert('Éxito', 'Formulario enviado correctamente');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar formulario';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.loadingText}>Cargando formulario...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver a la pantalla anterior"
          >
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Formulario</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!schema) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver a la pantalla anterior"
          >
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Formulario</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>Formulario no disponible</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Formulario</Text>
      </View>
      <DynamicForm
        schema={schema}
        mode="edit"
        onSubmit={handleFormSubmit}
        submitLabel="Enviar formulario"
        submitting={submitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  backButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 14,
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
    margin: 16,
    fontSize: 14,
  },
});