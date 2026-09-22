# planillero-frontend

Aplicación móvil de Planillero. React Native con Expo (SDK 57) y TypeScript.

## Requisitos

- **Node 20+**
- La app de **Expo Go** en el teléfono, o un emulador de Android / simulador de iOS

No hace falta instalar el CLI de Expo: viene como dependencia del proyecto.

## Puesta en marcha

```bash
npm ci
cp .env.example .env    # y ajustá la URL del backend
npm start
```

`npm start` abre el servidor de desarrollo y muestra un código QR para abrir la app con Expo Go.

## Comandos

```bash
npm start           # servidor de desarrollo
npm run android     # abrir en emulador o dispositivo Android
npm run ios         # abrir en simulador de iOS (requiere macOS)
npm run web         # abrir en el navegador

npm run lint        # ESLint; los warnings también fallan
npx tsc --noEmit    # chequeo de tipos
npm test            # tests con Jest
```

## Autenticación

La app implementa el flujo completo de sesión contra el backend:

- **Login**: `POST /auth/login` → si el usuario tiene 2FA habilitado, pide código TOTP en segundo paso (`POST /auth/verify-2fa`).
- **Tokens**: access token (JWT) + refresh token (opaco) se guardan en **SecureStore** (Keychain en iOS, Keystore en Android, respaldado por hardware). En plataformas sin almacén seguro (web, tests) hay un respaldo en memoria.
- **Bearer automático**: el cliente HTTP (`src/api/client.ts`) adjunta `Authorization: Bearer <accessToken>` en cada petición autenticada.
- **Refresh transparente**: ante `401` por access token expirado, el cliente refresca con el refresh token (rotativo, el viejo queda invalidado), reintenta la petición original y actualiza los tokens en SecureStore. Si el refresh falla, cierra la sesión y redirige al login.
- **Cierre de sesión**: `POST /auth/logout` revoca el refresh token y limpia SecureStore.
- **2FA**: pantallas dedicadas para habilitar/deshabilitar (`/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/disable`), accesibles desde la sesión autenticada.

### Archivos clave

| Archivo | Qué hace |
|---|---|
| `src/auth/tokenStore.ts` | Leer/escribir/borrar tokens en SecureStore (con fallback memoria). |
| `src/auth/SessionContext.tsx` | Estado de sesión (usuario, roles, `signIn`, `signOut`), proveedor React. |
| `src/api/auth.ts` | `login`, `verifyTwoFactor`, `logout`, `getMe`, `setup/enable/disableTwoFactor`. |
| `src/api/client.ts` | Cliente HTTP: Bearer, manejo de 401→refresh→reintento, unión discriminada para errores de red. |
| `src/app/login.tsx` | Pantalla de login con paso 2FA y mensajes que no revelan qué campo falló. |
| `src/app/_layout.tsx` | Envuelve la app con `SessionProvider` y protege rutas. |

## Conexión con el backend

La pantalla inicial consulta `GET /salud` del backend y muestra si hay conexión. Es el diagnóstico
más rápido para saber si la configuración quedó bien.

La URL sale de `EXPO_PUBLIC_API_URL` (ver `.env.example`). **El prefijo `EXPO_PUBLIC_` no es
opcional**: sin él, la variable no llega al bundle y la app la lee como `undefined`.

### Qué poner según dónde corras la app

| Dónde corre la app | Valor de `EXPO_PUBLIC_API_URL` |
|---|---|
| Navegador (`npm run web`), backend local | `http://localhost:8080` |
| Emulador de Android, backend local | `http://10.0.2.2:8080` |
| Simulador de iOS, backend local | `http://localhost:8080` |
| Teléfono físico, backend local | `http://<IP de tu computadora>:8080` |

En el emulador de Android, `localhost` es el propio emulador y no la máquina que lo hospeda: por eso
`10.0.2.2`. En un teléfono físico hace falta la IP de tu computadora en la red local, y que las dos
estén en la misma red.

El backend corre local (`cd ../backend && ./mvnw spring-boot:run`).

### Verificar el flujo completo

1. Levantar backend y frontend.
2. Abrir la app → pantalla de login.
3. Ingresar `operador.demo / Operador123!` → entra directo (sin 2FA), muestra home con usuario/rol y estado de `/salud`.
4. Cerrar sesión → vuelve al login.
5. Ingresar `supervisor.demo / Supervisor123!` tras haber habilitado 2FA → pide código TOTP → tras código correcto, entra a home.

## Generar el APK con Docker

Para probar en una tablet Android sin instalar Android Studio ni el SDK, el APK se compila dentro de
un contenedor (`docker/Dockerfile.apk`: Node 24 + JDK 17 + Android SDK, `expo prebuild` + Gradle):

```bash
sh scripts/build-apk.sh http://192.168.0.10:8080     # en Windows, con Git Bash
# → dist-apk/planillero.apk
```

- El argumento es la **URL del backend**, que queda dentro del APK como `EXPO_PUBLIC_API_URL`. En una
  tablet `localhost` es la propia tablet: poné la IP de la computadora que corre el backend (o su
  dominio). Nunca pongas secretos ahí: cualquiera con el APK puede leerla.
- Si la URL es `http://`, el build habilita HTTP sin TLS (`usesCleartextTraffic`) **sólo en ese APK**:
  Android lo bloquea en los builds de release y el backend del compose no tiene TLS. Con `https://` no
  se toca. La configuración de la app (`app.json`) no cambia.
- Se compila para `linux/amd64` (el Android SDK para Linux sólo existe ahí). En un Mac con Apple
  Silicon Docker lo emula: anda, pero tarda más.
- La **primera vez tarda bastante y baja varios GB** (Android SDK y dependencias de Gradle); las
  siguientes reusan la caché de Docker.
- El APK sale firmado con la clave de **debug** que genera `expo prebuild`: sirve para instalar en
  equipos de prueba, **no para publicar**. Un release real necesita un keystore propio.
- No forma parte del `docker compose` de servicios del repo `backend`: es una herramienta de build.

## Estructura

```
src/
├── app/                  # rutas (expo-router: cada archivo es una pantalla)
│   ├── _layout.tsx       # layout raíz + SessionProvider + rutas protegidas
│   ├── index.tsx         # home protegida: usuario, rol, estado /salud, cerrar sesión
│   └── login.tsx         # formulario login + paso 2FA
├── api/
│   ├── client.ts         # HTTP: Bearer, 401→refresh→reintento, unión discriminada
│   ├── auth.ts           # login, verify-2fa, logout, me, 2FA setup/enable/disable
│   └── client.test.ts    # tests: Bearer, 401→refresh, errores de red
├── auth/
│   ├── tokenStore.ts     # SecureStore (con fallback memoria)
│   ├── SessionContext.tsx # sesión + proveedor
│   └── tokenStore.test.ts
├── constants/
│   └── env.ts            # única lectura de variables de entorno
└── ...
```

El alias `@/` apunta a `src/`. Importá `@/api/client`, no rutas relativas largas.

### Convenciones

- **Las variables de entorno se leen sólo en `src/constants/env.ts`.** El resto del código importa de
  ahí y nunca toca `process.env`. Así hay un único lugar donde ver qué configura la app.
- **El cliente HTTP no lanza excepciones por fallos de red.** Devuelve una unión discriminada
  (`{ estado: 'conectado' } | { estado: 'error' }`) que obliga a contemplar el caso de error: en una
  app móvil quedarse sin conexión es un estado esperado, no una excepción.
- **`fetch` nativo, no `axios`.** Para lo que hay hoy no aporta nada. Cuando haya autenticación y
  hagan falta interceptors, se incorpora; el cliente está detrás de una función, así que el cambio
  toca un solo archivo.

## Cómo se trabaja en este repo

Este repo se clona **dentro** del workspace del harness, no suelto:

```
planillero/          # repo del harness: protocolo, specs y scripts
├── backend/
└── frontend/        # este repo
```

Las tareas salen de Jira y se llevan por el ciclo que describe `AGENTS.md` en ese repo. El push
directo a `main` está bloqueado por un hook: el trabajo va en una rama `PLAN-<n>-<slug>` y entra por
pull request.