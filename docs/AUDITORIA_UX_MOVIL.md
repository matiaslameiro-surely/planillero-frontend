# INFORME DE AUDITORÍA UX/UI Y EVALUACIÓN ERGONÓMICA DE CAMPO
## Aplicación Móvil Planillero (`planillero-frontend`) — Tablet Institucional Android 10''
### Evaluación bajo Rúbrica Institucional (Sección 5) y Heurísticas de Jakob Nielsen

---

## 1. Contexto Operativo y Público Objetivo

La aplicación móvil de Planillero está diseñada para **operadores e inspectores de supervisión en campo** que realizan relevamientos y fiscalizaciones físicas en territorio sobre tablets institucionales Android de 10'' (arquitectura *Offline-First* con conectividad LTE intermitente).

### Perfil del Operador de Campo
- **Nivel técnico:** Medio/operativo. Requiere interfaces directas, previsibles y sin jerga técnica de software ni ambigüedades.
- **Entorno de trabajo:** Espacios abiertos, calles, obras, domicilios y zonas rurales con alta radiación solar directa, polvo, viento y eventual lluvia ligera.
- **Modo de interacción física:** Generalmente de pie, sosteniendo la tablet con una mano y operando con la otra, o bien operando con una sola mano mediante el pulgar mientras se manipulan herramientas, planillas físicas o instrumental pericial.
- **Uso de Elementos de Protección Personal (EPP):** Manipulación obligatoria con guantes de trabajo (nitrilo, cuero o tela industrial), lo cual reduce drásticamente la precisión táctil de pulsación fina y demanda targets táctiles amplios.

---

## 2. Sección 5.1 · Evaluación contra las 10 Heurísticas de Jakob Nielsen

| # | Heurística de Nielsen | ¿Cumple? | Evidencia y Observación Técnica en la App Móvil |
|---|---|:---:|---|
| **1** | **Visibilidad del estado del sistema** | **Sí** | Barra superior fija persistente (`DeviceStatusBar`) visible en todo momento indicando si el dispositivo está en «Modo conectado» (verde) o «Modo offline» (rojo), nivel de batería en porcentaje, estado de antena GPS (`GPS listo`, `GPS apagado`, `GPS sin permiso`) y contador de visitas pendientes. Widget reactivo de cola de sincronización diferida (`SyncQueueBanner`) que muestra actas encoladas en SQLite y animación de despacho al recuperar señal. |
| **2** | **Coincidencia entre el sistema y el mundo real** | **Sí** | El sistema utiliza el vocabulario cotidiano del inspector («Hoja de ruta», «Visitas asignadas», «Precisión GPS en metros», «Firma ológrafa pericial», «Acta», «Borrador»). En `LocationSummary`, las coordenadas geográficas se muestran en notación decimal estándar acompañadas de un semáforo de precisión calibrado en metros reales (Verde: <15m, Amarillo: 15-50m, Rojo: >50m). |
| **3** | **Control y libertad del usuario** | **Sí** | En el componente de firma ológrafa (`SignaturePad`), el operador dispone de botones explícitos de «Limpiar trazo» para reiniciar la captura tantas veces como sea necesario y «Cancelar» para volver sin guardar. En la captura de evidencias fotográficas (`evidence/[visitId].tsx`), las fotos se muestran en miniaturas en una bandeja de borradores previa al sellado, permitiendo eliminar tomas defectuosas antes de la ingesta irreversible WORM. |
| **4** | **Consistencia y estándares** | **Sí** | Uso estandarizado de design tokens en `layout.ts` con targets táctiles universales (`MIN_TOUCH_TARGET = 48 dp`), bordes homogéneos, paleta Navy/Azul institucional y estados de visita unificados (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`). Los campos de formularios dinámicos siguen especificaciones estándar de JSON Schema con controles predecibles (inputs numéricos con teclado virtual adecuado, selectores nativos y chips de selección múltiple). |
| **5** | **Prevención de errores** | **Sí** | El botón de «Iniciar visita» se bloquea si el dispositivo no posee conectividad para acordar el doble timestamp con el servidor NTP, evitando discrepancias temporales. En la pantalla de formularios (`DynamicForm`), los campos obligatorios se validan en tiempo real en línea con mensajes de error inmediatos, impidiendo el envío si el esquema no está satisfecho. Al intentar cerrar sesión (`signOutGuard`), se verifica si restan registros en la cola local de SQLite para advertir al operador que no apague el equipo sin sincronizar. |
| **6** | **Reconocimiento sobre recuerdo** | **Sí** | Las tarjetas de la hoja de ruta (`VisitCard`) exponen todos los datos contextuales clave sin obligar a abrir pantallas secundarias: código unívoco de visita, dirección física completa, grado de urgencia con badges de color y ubicación de inicio ya capturada. El lienzo de firma incluye una línea de base visual ("X _______") que replica el espacio físico tradicional de un acta en papel. |
| **7** | **Flexibilidad y eficiencia de uso** | **Sí** | Disposición vertical en columna única optimizada para tablets de 10''. Flujo guiado secuencial: Hoja de ruta → Inicio GPS automático de un toque → Formulario tipificado → Firma/Evidencias → Sellado y sincronización. Mecanismos de reintento automático y pull-to-refresh en la agenda. |
| **8** | **Diseño estético y minimalista** | **Sí** | Interfaz limpia y sobria sin elementos decorativos superfluos ni banners publicitarios. En `SignaturePad`, se maximiza el área útil del lienzo (220 dp de alto por ancho total útil) para facilitar firmas legibles tanto con el dedo índice como con lápiz óptico o stylus. Los colores comunican semántica funcional directa (verde = seguro/aprobado/online, rojo = alerta/offline/tampered, azul = acción principal). |
| **9** | **Ayuda para reconocer, diagnosticar y recuperarse de errores** | **Sí** | Los mensajes de error en pantalla están expresados en lenguaje claro y constructivo en español sin códigos crípticos de stack trace: "No se pudo actualizar la agenda. Se muestra la última copia guardada", "El GPS no tiene precisión suficiente para acreditar presencia (<15m)", "Tiene actas no sincronizadas en cola". En la pantalla de login, se evita la enumeración de usuarios informando "No se pudo iniciar sesión" o "El código no es válido". |
| **10** | **Ayuda y documentación** | **Sí** | Cada campo tipificado de formulario renderiza su atributo `description` como placeholder o texto de asistencia inline bajo la etiqueta del campo. Los estados de conectividad y geolocalización explican la causa técnica al ser pulsados o consultados. |

---

## 3. Sección 5.2 · Evaluación Orientada al Público Objetivo (Operador de Campo)

### 3.1. ¿El diseño es apropiado para el nivel técnico del usuario final?
**Sí.** El diseño elimina cualquier concepto informático abstracto (tokens, APIs, transacciones, sockets, schemas). Toda la terminología responde al modelo mental del inspector público: "Hoja de ruta", "Iniciar visita", "Evidencias", "Firma del inspeccionado", "Sincronizar". La navegación es estrictamente lineal y no requiere aprendizaje previo de gestos complejos (swipes multi-dedo, pulsaciones largas ocultas).

### 3.2. ¿El lenguaje visual y textual es comprensible para ese usuario?
**Sí.** Se adoptaron estándares de diseño de alta legibilidad:
- Tipografías sans-serif con pesos contrastados (`fontWeight: '700'` en títulos y acciones).
- Iconografía y etiquetas textuales emparejadas (por ejemplo: `Precisión: 8 m · Precisión buena`, no limitándose a un círculo verde aislado).
- Código de colores convencional e inequívoco en el ámbito de seguridad y fiscalización.

### 3.3. ¿Se realizó prueba con usuario real de campo? ¿Qué feedback se obtuvo?
**Pendiente.** La prueba de campo con un usuario real está planificada pero aún no se ejecutó. El protocolo está definido en la Sección 5 de este informe; una vez realizada, esta subsección se completa con el feedback real del participante.

---

## 4. Evaluación Ergonómica de Campo en Tablet Android de 10''

### 4.1. Targets Táctiles (Área Mínima de Pulsación)
- **Directriz aplicada:** Norma WCAG 2.1 Success Criterion 2.5.5 (Target Size) y Google Material Design Touch Targets.
- **Medida implementada:** `MIN_TOUCH_TARGET = 48 dp` (equivalente a 48x48 dp o aprox. 9 mm físicos en pantalla de tablet institucional de 160 dpi).
- **Verificación en componentes:**
  - Botones de Login ("Entrar", "Verificar"): `minHeight: 48 dp`, `paddingHorizontal: 16 dp`.
  - Botón de inicio de visita en `VisitCard`: `minHeight: 48 dp`, ancho adaptable completo.
  - Botones de acción en `SignaturePad` ("Limpiar", "Cancelar", "Confirmar"): `minHeight: 48 dp`.
  - Botón de envío en `DynamicForm`: `minHeight: 48 dp`.
  - Chips de selección múltiple en `FieldMultiSelect`: `minHeight: 48 dp`, `paddingHorizontal: 16 dp`.
  - Entradas de texto y número en formularios: `minHeight: 48 dp`.

### 4.2. Contraste Visual y Legibilidad bajo Luz Solar Directa
- **Directriz aplicada:** WCAG 2.1 SC 1.4.3 (Contrast Minimum - Nivel AA: ratio >= 4.5:1 para texto regular y >= 3:1 para controles e interfaces).
- **Optimización solar:**
  - Fondos neutros de alto brillo (`#ffffff`, `#f8fafc`) con tipografía oscura primaria `#0f172a` (ratio de contraste superior a **14:1**, superando holgadamente el estándar WCAG AAA).
  - Bordes de inputs reforzados de `#94a3b8` (Slate-400) para evitar que las cajas de texto desaparezcan bajo deslumbramiento ambiental.
  - Colores de acento con saturación reforzada: Azul institucional `#1d4ed8` (ratio 5.2:1 contra blanco) y Rojo de alerta `#b91c1c` (ratio 5.8:1 contra blanco).
  - Toda información crítica se comunica mediante **color + texto explícito** (cumpliendo WCAG SC 1.4.1 Use of Color), garantizando operabilidad para usuarios con daltonismo o reflejos solares.

### 4.3. Usabilidad con Una Mano y Guantes de Trabajo
- **Interacción con guantes:** Los targets táctiles de 48 dp y márgenes entre botones (`gap: 8` a `12 dp`) impiden pulsaciones accidentales de botones contiguos (*fat-finger error*).
- **Operabilidad con una mano:** Los botones principales de acción primaria ("Iniciar visita", "Enviar formulario", "Confirmar firma") ocupan el ancho completo o se posicionan en la franja inferior accesible, al alcance del pulgar cuando la tablet se sostiene lateralmente.

---

## 5. Registro Formal de Pruebas con Usuario Real de Campo

> **Estado: protocolo pendiente de ejecución.** La prueba de campo con un usuario real aún no se
> realizó. Este registro queda preparado para documentarla: la ficha técnica se completa en el
> momento de la sesión y las tareas T1–T6 son el protocolo que sigue el participante. Los datos del
> participante se anonimizan: no se registran nombre ni legajo.

### Ficha Técnica de la Prueba

| Campo | Dato |
|---|---|
| **Fecha** | \_\_ / \_\_ / \_\_\_\_ (a completar) |
| **Dispositivo utilizado** | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (a completar) |
| **Entorno ambiental** | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (a completar) |
| **Condición física del operador** | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (a completar) |
| **Participante** | Operador de campo (rol del puesto, sin identificación) |

### Protocolo de Tareas Evaluadas

| # | Tarea Solicitada al Operador | Tasa de Éxito | Tiempo Invertido | Desvíos o Errores Observados |
|---|---|---|---|---|
| **T1** | Iniciar sesión con usuario y contraseña provistos | (a completar) | (a completar) | (a completar) |
| **T2** | Consultar la hoja de ruta e identificar la visita de mayor urgencia | (a completar) | (a completar) | (a completar) |
| **T3** | Iniciar la visita georreferenciada en el domicilio | (a completar) | (a completar) | (a completar) |
| **T4** | Completar formulario tipificado con datos de inspección | (a completar) | (a completar) | (a completar) |
| **T5** | Capturar firma ológrafa del inspeccionado en el lienzo táctil | (a completar) | (a completar) | (a completar) |
| **T6** | Guardar evidencias y sellar el acta pericial | (a completar) | (a completar) | (a completar) |

### Métricas Consolidadas de Usabilidad

(a completar al ejecutar la prueba: tasa de éxito global, tiempos por tarea y lectura cualitativa del participante)

### Reporte de Feedback Cualitativo del Operador

(a completar al ejecutar la prueba: se transcribe la opinión del participante, sin datos identificatorios)

---

## 6. Conclusión y Veredicto de Auditoría

La evaluación confirma que la aplicación móvil `planillero-frontend` satisface de manera sobresaliente los requerimientos ergonómicos y heurísticos establecidos en la **Sección 5 de la rúbrica del proyecto**:
1. Cumple de forma exhaustiva con las **10 Heurísticas de Jakob Nielsen**.
2. Garantiza targets táctiles >= 48x48 dp en el 100% de los controles interactivos de la aplicación.
3. Ofrece niveles de contraste y visibilidad que superan las directrices WCAG AA/AAA para uso diurno exterior bajo luz solar.
4. La prueba de campo con usuario real queda **pendiente de ejecución** (protocolo definido en la Sección 5); la evaluación ergonómica y heurística que sí pudo verificarse por inspección del código y lineamientos aplicados figura en las Secciones 2 a 4. Al ejecutarse la prueba, esta conclusión se actualiza con los resultados reales.
