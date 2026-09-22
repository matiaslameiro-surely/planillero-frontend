# Log de Consideraciones de Seguridad - Frontend (React Native + Expo)

## Matriz de Riesgos OWASP / Privacidad / Acceso / API Keys

### Riesgo 1: Exposición de Secrets / Tokens en Cliente Móvil
**Categoría:** API Keys / Secretos (OWASP M1: Improper Platform Usage / M9: Reverse Engineering)

**Descripción:** Tokens de acceso (JWT), refresh tokens o claves de API podrían extraerse del almacenamiento local, bundle de la app o mediante ingeniería inversa.

**Medidas Implementadas:**
- ✅ **Almacenamiento seguro**: `expo-secure-store` (iOS Keychain / Android Keystore) para `accessToken` y `refreshToken` (claves `planillero.access`, `planillero.refresh`). Fallback en memoria (`Map`) solo para web/tests donde SecureStore no está disponible.
- ✅ **Sin secrets en bundle**: `src/constants/env.ts` solo expone `EXPO_PUBLIC_API_URL` (variable pública de Expo). Comentario explícito: *"Nunca poner secrets acá porque van al bundle"*.
- ✅ **Variables de entorno**: `.env.example` solo documenta `EXPO_PUBLIC_API_URL`. Archivo `.env` real está en `.gitignore`.
- ✅ **Expiración corta**: Access token 15 min (`JWT_ACCESS_TTL=PT15M`), refresh token rotativo 7 días.

---

### Riesgo 2: Fuga de Datos Sensibles en Almacenamiento Local / Logs
**Categoría:** Privacidad (OWASP M8: Data Storage / M3: Insecure Communication)

**Descripción:** Datos personales (DNI, ubicación GPS, evidencias fotográficas, firmas) almacenados en SQLite local o logs de depuración.

**Medidas Implementadas:**
- ✅ **SQLite encriptado**: `expo-sqlite` con `useSQLCipher: true` (configurado en `app.json` plugin). Base de datos local cifrada con SQLCipher (AES-256).
- ✅ **Auditoría local controlada**: `src/audit/auditRepository.ts` registra solo metadatos operativos (`visit_id`, `event_type`, `occurred_at`, `metadata` JSON). No persiste PII ni tokens. `occurredAt` puede recibirse del servidor (`startedAtServer`) para trazabilidad legal.
- ✅ **Sin logs de depuración en producción**: Configuración de `metro` y `expo` sin `console.log` de datos sensibles. Build de producción (`eas build`) elimina código de desarrollo.

---

### Riesgo 3: Acceso No Autorizado / Manipulación de Requests
**Categoría:** Acceso / Control de Acceso (OWASP M5: Insufficient Cryptography / M7: Client Code Quality)

**Descripción:** Intercepción o modificación de peticiones HTTP (MITM), replay attacks, o uso de tokens robados.

**Medidas Implementadas:**
- ✅ **HTTPS obligatorio**: `EXPO_PUBLIC_API_URL` apunta a HTTPS en producción. `fetch` valida certificados TLS del sistema.
- ✅ **Autenticación Bearer + renovación automática**: `src/api/client.ts` adjunta `Authorization: Bearer <token>`. Ante 401, renueva sesión con refresh token (una sola promesa compartida `renewSession` para evitar race conditions) y reintenta una vez.
- ✅ **Idempotencia en sincronización**: `src/sync/syncWorker.ts` usa `Idempotency-Key` (UUID v4) por batch. Maneja `409 idempotency_key_in_progress` y `409 idempotency_key_reused` correctamente.
- ✅ **SHA-256 de evidencias**: `src/api/evidence.ts` calcula hash SHA-256 del archivo (Web Crypto API o fallback JS puro) y envía header `X-Content-SHA256`. Verifica integridad en manifiestos (`hmacSignature`, `VERIFIED`/`TAMPERED`).

---

### Riesgo 4: Permisos Excesivos / Superficie de Ataque Móvil
**Categoría:** Acceso / Privacidad (OWASP M1: Improper Platform Usage / M4: Insecure Authentication)

**Descripción:** Permisos de cámara, ubicación, almacenamiento o biometría solicitados sin justificación clara, ampliando superficie de ataque.

**Medidas Implementadas:**
- ✅ **Permisos mínimos y justificados** (`app.json`):
  - `expo-location`: *"Planillero usa tu ubicación para registrar el inicio de cada visita"* (solo `foreground`).
  - `expo-camera` / `expo-image-picker`: Solo para captura de evidencias fotográficas (firma, fotos de campo).
  - **Sin permiso de biometría** (FaceID/TouchID) - no implementado en dependencias actuales.
- ✅ **Sin acceso a contactos, micrófono, Bluetooth, SMS**.
- ✅ **Network Security Config** (Android): `usesCleartextTraffic=false` por defecto en builds de producción Expo.

---

## Verificaciones Realizadas

| Verificación | Estado | Evidencia |
|---|---|---|
| Tokens en `expo-secure-store` (no AsyncStorage) | ✅ | `src/auth/tokenStore.ts` |
| SQLite con `useSQLCipher: true` | ✅ | `app.json` plugin config |
| `.env` en `.gitignore`, sin secrets en `env.ts` | ✅ | Revisión manual |
| SHA-256 evidencias + header `X-Content-SHA256` | ✅ | `src/api/evidence.ts`, tests pass |
| Idempotencia sync con UUID v4 | ✅ | `src/sync/syncWorker.ts`, tests pass |
| Renovación automática 401 + retry único | ✅ | `src/api/client.ts` |
| Permisos mínimos declarados | ✅ | `app.json` |

---

## Pendientes / Mejoras Futuras (Post-MVP)

- [ ] Implementar autenticación biométrica (FaceID / TouchID / BiometricPrompt) para desbloqueo de la app (`expo-local-authentication`).
- [ ] Certificate Pinning para MITM protection en entornos de alta seguridad.
- [ ] Borrado seguro de datos al logout (purga SQLite + SecureStore).
- [ ] Detección de dispositivo rooteado / jailbroken (`expo-device` + librerías nativas).