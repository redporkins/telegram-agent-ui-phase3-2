# telegram-agent-ui-phase3

Agente de gestión de proyectos Agile accesible desde **Telegram** y desde una **interfaz web** integrada. Ambos canales comparten el mismo motor de intenciones (`AgentOrchestrator`).

---

## Ajustes realizados

### 1. Corrección del cliente Gemini (`LlmIntentParser.java`)

**Problema:** El código original usaba el formato de OpenAI (`/chat/completions`, cabecera `Authorization: Bearer`, campo `messages[{role, content}]`, respuesta en `choices[0].message.content`).

**Solución:** Se adaptó al formato nativo de Gemini:
- La URL completa se construye dinámicamente: `{base-url}/models/{model}:generateContent`
- La autenticación usa la cabecera `x-goog-api-key` en vez de `Authorization: Bearer`
- El cuerpo de la petición usa el formato `{ "contents": [{ "parts": [{ "text": "..." }] }] }`
- La respuesta se extrae de `candidates[0].content.parts[0].text`
- Se limpia posible Markdown (bloques ` ```json `) que Gemini puede devolver alrededor del JSON

### 2. Corrección de `application.properties`

**Problema:** El archivo tenía dos bloques duplicados (uno comentado y uno activo), la última línea terminaba con `=` roto, y `agent.ai.model` apuntaba a `gpt-4o-mini` (modelo de OpenAI).

**Solución:**
- Se eliminó el bloque comentado
- Se corrigió la última línea (`logging.level.com.oraclebot=DEBUG`)
- `agent.ai.base-url` apunta a `https://generativelanguage.googleapis.com/v1beta`
- `agent.ai.model` cambia a `gemini-2.0-flash`
- Los tokens sensibles se marcaron con `REEMPLAZAR_CON_..._REAL` para no exponer credenciales

### 3. Mejoras de la interfaz web (`index.html`, `styles.css`, `app.js`)

Se rediseñó completamente la UI aplicando los patrones aprendidos en `practica_api_clase_parte_2`:

| Área | Mejora |
|---|---|
| **Formulario** | Labels explícitas, campo de título con `required` marcado, feedback de validación en pantalla |
| **Estados de carga** | Spinner animado al cargar tareas; botón deshabilitado mientras procesa |
| **Feedback del formulario** | Mensaje de éxito/error debajo del botón, se limpia solo después de 3.5 s |
| **Tarjetas de tareas** | Layout mejorado: título + badge en la misma línea, metadatos con íconos, hover con sombra sutil |
| **Chat** | Burbuja "Pensando…" durante la espera; burbuja de error diferenciada; botón "Limpiar" conversación |
| **Sugerencias de chat** | Botones tipo pill más accesibles y con más opciones |
| **Diseño general** | Header fijo con logo, paleta de colores consistente, totalmente responsive (<900 px pasa a 1 columna) |
| **Accesibilidad** | `aria-live` en el chat, `role="log"`, `novalidate` en formularios para control manual |

---

## Configuración

Copia `src/main/resources/application.properties` y rellena las variables de entorno (o edita directamente el archivo en desarrollo):

```properties
telegram.bot.token=TU_TOKEN_TELEGRAM
agent.ai.api-key=TU_API_KEY_GEMINI
agent.ai.model=gemini-2.0-flash     # o gemini-1.5-flash, etc.
```

Las claves también pueden inyectarse por variables de entorno:

```bash
TELEGRAM_BOT_TOKEN=xxx AGENT_AI_API_KEY=xxx mvn spring-boot:run
```

---

## Ejecución

```bash
mvn spring-boot:run
```

La interfaz web estará disponible en `http://localhost:8080`.

---

## Arquitectura

```
Telegram ──► TelegramAgentBot
                    │
Web UI   ──► AssistantController  ──► AgentOrchestrator ──► LlmIntentParser (Gemini)
                    │                         │                      │ (fallback)
             TaskController          ProjectWorkspaceService   RuleBasedIntentParser
```
