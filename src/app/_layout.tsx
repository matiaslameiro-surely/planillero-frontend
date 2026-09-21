import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { SessionProvider } from '@/auth/SessionContext';
import { DatabaseProvider } from '@/db/DatabaseProvider';

import { useHeartbeat } from '@/status/useHeartbeat';

function HeartbeatEmitter() {
  useHeartbeat();
  return null;
}

/**
 * Layout raíz de la aplicación.
 *
 * Monta el proveedor de sesión por encima del `Stack`: la sesión tiene que estar disponible para
 * todas las pantallas, y es acá donde se resuelve una sola vez si el usuario está logueado. La base
 * local va adentro de la sesión porque es del operador logueado.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <DatabaseProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <HeartbeatEmitter />
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </DatabaseProvider>
    </SessionProvider>
  );
}
