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
import { MIN_TOUCH_TARGET, useThemeColors } from '@/constants/layout';

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
  const colors = useThemeColors();

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

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurface,
      borderColor: colors.borderDefault,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgBackdrop }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Planillero</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {step === 'credentials' ? 'Iniciá sesión' : 'Ingresá el código de verificación'}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderDefault,
          },
        ]}>
        {step === 'credentials' ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Usuario</Text>
            <TextInput
              style={inputStyle}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              accessibilityLabel="Usuario"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Contraseña</Text>
            <TextInput
              style={inputStyle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              onSubmitEditing={() => void submitCredentials()}
              accessibilityLabel="Contraseña"
            />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Código de 6 dígitos</Text>
            <TextInput
              style={inputStyle}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              onSubmitEditing={() => void submitCode()}
              accessibilityLabel="Código de verificación de 6 dígitos"
            />
          </>
        )}

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            submitting && { backgroundColor: colors.borderStrong },
            pressed && !submitting && styles.buttonPressed,
          ]}
          onPress={() => void (step === 'credentials' ? submitCredentials() : submitCode())}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={step === 'credentials' ? 'Entrar a Planillero' : 'Verificar código de autenticación'}
          accessibilityState={{ disabled: submitting }}>
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
  subtitle: { fontSize: 16, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  label: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: MIN_TOUCH_TARGET,
  },
  error: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  button: {
    marginTop: 16,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
