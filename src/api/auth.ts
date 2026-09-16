import { request, requestWithAuth } from '@/api/client';
import type { Tokens } from '@/auth/tokenStore';

/** Usuario autenticado, tal como lo devuelve `GET /auth/me`. */
export interface Me {
  username: string;
  roles: string[];
  twoFactorEnabled: boolean;
}

/** Datos para configurar el segundo factor. */
export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

/** Resultado del login: o ya hay tokens, o falta el código de 2FA. */
export type LoginResult =
  | { twoFactorRequired: true; challengeId: string }
  | { twoFactorRequired: false; tokens: Tokens };

interface LoginResponse {
  twoFactorRequired: boolean;
  challengeId?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Inicia sesión con usuario y contraseña.
 *
 * Si el usuario tiene 2FA habilitado, el backend no entrega tokens: devuelve un desafío que hay que
 * completar con `verifyTwoFactor`.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  if (response.twoFactorRequired) {
    if (!response.challengeId) {
      throw new Error('El backend pidió 2FA pero no envió el desafío.');
    }
    return { twoFactorRequired: true, challengeId: response.challengeId };
  }

  return {
    twoFactorRequired: false,
    tokens: {
      accessToken: response.accessToken ?? '',
      refreshToken: response.refreshToken ?? '',
    },
  };
}

/** Completa el login con el código TOTP y devuelve los tokens de la sesión. */
export function verifyTwoFactor(challengeId: string, code: string): Promise<Tokens> {
  return request<Tokens>('/auth/verify-2fa', {
    method: 'POST',
    body: { challengeId, code },
  });
}

/** Revoca la sesión en el backend. */
export function logout(refreshToken: string): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST', body: { refreshToken } });
}

/** Datos del usuario autenticado. */
export function getMe(): Promise<Me> {
  return requestWithAuth<Me>('/auth/me');
}

/** Genera un secreto TOTP pendiente de confirmación. */
export function setupTwoFactor(): Promise<TwoFactorSetup> {
  return requestWithAuth<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' });
}

/** Confirma el secreto pendiente y activa el 2FA. */
export function enableTwoFactor(code: string): Promise<void> {
  return requestWithAuth<void>('/auth/2fa/enable', { method: 'POST', body: { code } });
}

/** Desactiva el 2FA. */
export function disableTwoFactor(code: string): Promise<void> {
  return requestWithAuth<void>('/auth/2fa/disable', { method: 'POST', body: { code } });
}
