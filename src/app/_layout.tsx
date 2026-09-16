import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

/**
 * Layout raíz de la aplicación.
 *
 * Por ahora es un `Stack` con una sola pantalla. Cuando haya navegación de verdad (pestañas,
 * flujo de autenticación), esto se reemplaza; hasta entonces no tiene sentido montar una
 * estructura que todavía no navega a ningún lado.
 */
export default function LayoutRaiz() {
  const esquemaDeColor = useColorScheme();

  return (
    <ThemeProvider value={esquemaDeColor === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
