import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { obtenerSalud, type ResultadoSalud } from '@/api/cliente';
import { URL_API } from '@/constants/env';

/** Lo que se está mostrando: la consulta en curso o su resultado. */
type Estado = { tipo: 'consultando' } | { tipo: 'resuelto'; resultado: ResultadoSalud };

/**
 * Pantalla inicial.
 *
 * Además de dar la bienvenida, sirve de diagnóstico: muestra si la app puede hablar con el backend.
 * En un esqueleto eso vale más que una pantalla linda, porque es el primer lugar donde se ve si la
 * configuración de entorno quedó bien.
 */
export default function Inicio() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'consultando' });

  const consultar = useCallback(async () => {
    setEstado({ tipo: 'consultando' });
    const resultado = await obtenerSalud();
    setEstado({ tipo: 'resuelto', resultado });
  }, []);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Planillero</Text>
      <Text style={estilos.subtitulo}>Aplicación móvil</Text>

      <View style={estilos.tarjeta}>
        <Text style={estilos.etiqueta}>Conexión con el backend</Text>
        <EstadoDeConexion estado={estado} />
        <Text style={estilos.url}>{URL_API}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado]}
        onPress={consultar}
        disabled={estado.tipo === 'consultando'}
        accessibilityRole="button">
        <Text style={estilos.textoBoton}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

function EstadoDeConexion({ estado }: { estado: Estado }) {
  if (estado.tipo === 'consultando') {
    return (
      <View style={estilos.fila}>
        <ActivityIndicator size="small" />
        <Text style={estilos.textoEstado}>Consultando…</Text>
      </View>
    );
  }

  if (estado.resultado.estado === 'conectado') {
    return (
      <View style={estilos.fila}>
        <View style={[estilos.punto, estilos.puntoOk]} />
        <Text style={estilos.textoEstado}>Conectado</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={estilos.fila}>
        <View style={[estilos.punto, estilos.puntoError]} />
        <Text style={estilos.textoEstado}>Sin conexión</Text>
      </View>
      <Text style={estilos.motivo}>{estado.resultado.motivo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  titulo: { fontSize: 32, fontWeight: '700' },
  subtitulo: { fontSize: 16, opacity: 0.6, marginBottom: 24 },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
    padding: 16,
    gap: 8,
  },
  etiqueta: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoEstado: { fontSize: 18, fontWeight: '600' },
  punto: { width: 10, height: 10, borderRadius: 5 },
  puntoOk: { backgroundColor: '#1a9e5c' },
  puntoError: { backgroundColor: '#c0392b' },
  motivo: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  url: { fontSize: 12, opacity: 0.5, fontFamily: 'monospace' },
  boton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: '#208AEF',
  },
  botonPresionado: { opacity: 0.7 },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
