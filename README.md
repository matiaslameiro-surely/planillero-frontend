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

El backend todavía no está desplegado en ningún servidor: hoy sólo corre local
(`cd ../backend && ./mvnw spring-boot:run`).

## Estructura

```
src/
├── app/                  # rutas (expo-router: cada archivo es una pantalla)
│   ├── _layout.tsx       # layout raíz
│   └── index.tsx         # pantalla inicial
├── api/
│   ├── cliente.ts        # cliente HTTP del backend
│   └── cliente.test.ts
└── constants/
    └── env.ts            # única lectura de variables de entorno
```

El alias `@/` apunta a `src/`. Importá `@/api/cliente`, no rutas relativas largas.

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
