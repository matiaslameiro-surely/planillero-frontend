# Registro del Recorrido E2E — PLAN-34

> Fecha: 2026-09-23. Entorno: `docker compose` local en `backend/`, override temporal que publica
> el backend en `0.0.0.0:8080` para una tablet en la misma LAN. El recorrido se ejecutó a **nivel de
> API** contra el stack real levantado (PostgreSQL 16 + MinIO + backend Spring Boot + backoffice
> Angular servido por NGINX). Los datos son los del seed de desarrollo (todos ficticios).

## Alcance del recorrido

El ciclo completo que describe la tarea, punta a punta:

1. **Backoffice / planificación**: el supervisor asigna visitas al operador.
2. **Móvil**: login del operador → agenda (hoja de ruta) → inicio de visita con GPS → formulario
   tipificado → evidencias y firma → sellado del manifiesto → sincronización (con idempotencia).
3. **Backoffice / supervisión**: tablero de supervisión, grilla de operadores, expediente (visor de
   formulario), verificación de auditoría.
4. **Verificación criptográfica**: manifiesto HMAC-SHA256 + cadena de auditoría SHA-256.

## Resultado por paso

| # | Paso | HTTP | Resultado |
|---|---|---|---|
| 1 | Planificación: asignar visitas al operador | 200 | 2 visitas en la hoja de ruta |
| 2 | Login operador (`operador.demo`) | 200 | access token emitido (sin 2FA en seed) |
| 3 | Hoja de ruta del operador (agenda) | 200 | 2 visitas asignadas |
| 4 | Inicio de visita con GPS (lat/long + precisión) | 200 | `IN_PROGRESS`, drift 0 s |
| 5 | Carga de formulario (`mantenimiento-general` v2) | 200 | Validado contra el JSON Schema y guardado |
| 6 | Subida de evidencia (foto) | 201 | SHA-256 calculado en servidor |
| 7 | Subida de firma (type=SIGNATURE) | 201 | Evidencia independiente del sello |
| 8 | Sellado del manifiesto | 201 | `VERIFIED`, HMAC-SHA256 firmado |
| 9 | Verificación del manifiesto | 200 | `signatureValid=true`, evidencias intactas |
| 10 | Sync por lote (idempotente) | 200 | `APPLIED`, con `Idempotency-Key` |
| 11 | Reintento del mismo lote | 200 | Idempotencia respeta: no duplica el acta |
| 12 | Login supervisor (`supervisor.demo`) | 200 | Access token emitido |
| 13 | Tablero de supervisión (`/supervision/tablero-resumen`) | 200 | KPIs y excepciones operativas |
| 14 | Grilla de operadores (`/supervision/operadores/estado`) | 200 | Telemetría en vivo |
| 15 | Planificación: lista de operadores | 200 | Selectores de la grilla |
| 16 | Expediente: visor del formulario (`/visitas/{id}/formulario`) | 200 | Detalle del formulario cargado |
| 17 | Verificación de auditoría (`/audit/verify`, admin) | 200 | `intacta: true` (cadena SHA-256 íntegra) |
| 18 | Auditoría: logs inmutables (`/audit/logs`, admin) | 200 | Registros disponibles |
| 19 | Backoffice web (NGINX `:8081`) | 200 | Página servida |
| 20 | Proxy backoffice → `/salud` | 200 | Proxy al backend funcionando |
| 21 | Logout operador | 204 | Refresh token revocado |

**Resultado: 21/21 pasos OK, 0 fallos.**

## Problemas encontrados

No se encontraron fallas funcionales en el recorrido a nivel de API. El ciclo completo opera de
punta a punta: asignación, visita georreferenciada, formulario validado por schema, evidencias con
hash verificable, sellado HMAC, sync idempotente y cierre de ciclo del supervisor con auditoría.

**Observación (no bloqueante, para la revisión humana):** el recorrido se ejecutó a nivel de API;
quedan sin cubrir las pantallas de UI (React Native en dispositivo y Angular en navegador) y la
instalación efectiva del APK en una tablet. Son la parte que la §5 del informe UX móvil declara
como pendiente de ejecución con dispositivo real.

## Cómo se reproduce

El script está en `specs/PLAN-34-pruebas-manuales-prueba-de-campo-apk-en/` del harness (referencia)
y usa los endpoints documentados en `backend/README.md`. En resumen:

```bash
# backend/ con Docker arriba
cp .env.example .env
docker compose up --build          # publish del 8080 en la LAN con docker-compose.override.yml
# luego: login operator -> route-sheet?date=HOY -> /visits/{id}/start ->
#        /visitas/{id}/formulario -> /evidences (multipart) -> /manifest ->
#        /manifest/verify -> /sync/batch (Idempotency-Key) ->
#        supervision/tablero-resumen -> audit/verify
```

Credenciales ficticias del seed: `operador.demo/Operador123!`, `supervisor.demo/Supervisor123!`,
`admin.demo/Admin123!`.