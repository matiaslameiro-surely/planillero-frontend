# Informe Final de Auditoría de Seguridad - Frontend (React Native + Expo)

## Resumen Ejecutivo

Auditoría de seguridad del cliente móvil Planillero (React Native + Expo) conforme a la Sección 6 del documento de entrega final del curso. Se identificaron y mitigaron 4 riesgos críticos en el contexto móvil (OWASP Mobile Top 10).

## Matriz de Riesgos y Estado

| # | Riesgo | Categoría OWASP Mobile | Estado | Medida Principal |
|---|---|---|---|---|
| 1 | Exposición Secrets / Tokens | M1 / M9 | ✅ Mitigado | `expo-secure-store` (Keychain/Keystore), sin secrets en bundle |
| 2 | Fuga PII en almacenamiento local | M8 / M3 | ✅ Mitigado | SQLite + SQLCipher (AES-256), auditoría local sin PII |
| 3 | MITM / Replay / Token theft | M5 / M7 | ✅ Mitigado | HTTPS, Bearer + auto-refresh, Idempotency-Key, SHA-256 evidencias |
| 4 | Permisos excesivos / Superficie ataque | M1 / M4 | ✅ Mitigado | Permisos mínimos: location (foreground), camera, sin biometría |

## Verificaciones Técnicas

| Verificación | Resultado | Comando / Evidencia |
|---|---|---|
| Lint (Expo) | ✅ Pass | `npm run lint` |
| TypeScript strict | ✅ Pass | `npx tsc --noEmit` |
| Tests (Jest) | ✅ 179/179 pass | `npm test -- --watchAll=false` |
| Tokens en SecureStore | ✅ Código | `src/auth/tokenStore.ts` |
| SQLite SQLCipher | ✅ Config | `app.json` plugin `useSQLCipher: true` |
| SHA-256 + header evidencias | ✅ Tests | `src/api/evidence.ts` tests pass |
| Sync idempotencia UUID | ✅ Tests | `src/sync/syncWorker.ts` tests pass |

## Video Demostrativo

**Enlace público:** `[PENDIENTE - Insertar URL de YouTube / Google Drive]`

**Parte móvil del video (incluida en video consolidado backend):**
- Login + 2FA en app móvil
- Inicio visita con GPS
- Captura evidencia + firma
- Sincronización offline → online

## Archivos Generados

- `security-log.md` — Matriz detallada con evidencias
- `informe.md` — Este documento

---

**Auditor:** Juan Ignacio Urrutia  
**Fecha:** 2026-09-22  
**Tarea Jira:** PLAN-17