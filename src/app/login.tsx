import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '@/auth/SessionContext';

/** En qué paso del login está el usuario. */
type Step = 'credentials' | 'twoFactor';

/**
 * Pantalla de login.
 *
 * Contempla los dos pasos del backend: primero usuario y contraseña y, si la cuenta tiene 2FA, el
 * código TOTP. Los mensajes de error no distinguen si falló el usuario o la contraseña.
 */
export default function Login() {
  const { status, signIn, confirmTwoFactor } = useSession();
  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  const submitCredentials = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(username.trim(), password);
      setStep(result.twoFactorRequired ? 'twoFactor' : 'credentials');
    } catch (failure) {
      setError(messageOf(failure, 'No se pudo iniciar sesión.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await confirmTwoFactor(code.trim());
    } catch (failure) {
      setError(messageOf(failure, 'El código no es válido.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planillero</Text>
      <Text style={styles.subtitle}>
        {step === 'credentials' ? 'Iniciá sesión' : 'Ingresá el código de verificación'}
      </Text>

      <View style={styles.card}>
        {step === 'credentials' ? (
          <>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              editable={!submitting}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              editable={!submitting}
              onSubmitEditing={() => void submitCredentials()}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Código de 6 dígitos</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              editable={!submitting}
              onSubmitEditing={() => void submitCode()}
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void (step === 'credentials' ? submitCredentials() : submitCode())}
          disabled={submitting}
          accessibilityRole="button">
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{step === 'credentials' ? 'Entrar' : 'Verificar'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function messageOf(failure: unknown, fallback: string): string {
  if (failure instanceof Error && failure.message) {
    return failure.message;
  }
  return fallback;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
    padding: 16,
    gap: 8,
  },
  label: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: '#c0392b', fontSize: 14, marginTop: 4 },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#208AEF',
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
