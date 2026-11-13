# AGENTS.md — Bandeja de soporte con IA

Reglas que cualquier agente de código (Claude Code, Codex, Copilot, Cursor) debe leer antes de tocar este repositorio. Si una regla no está aquí, el agente no la conoce.

## Qué es este proyecto

Bandeja de soporte para un negocio pequeño. Los clientes escriben por un formulario público; la IA sugiere una categoría y un borrador; un agente revisa, escribe la respuesta final y la aprueba. Node.js sin dependencias externas, SQLite y una interfaz HTML simple.

## Antes de escribir código

- Leer `docs/adr/` y `docs/gobernanza/`. Si un cambio contradice un ADR aceptado, no se hace: se propone un ADR nuevo.
- Leer `README.md` para los comandos de arranque y de pruebas.

## Datos

- Nunca escribir datos personales en logs, en mensajes de error ni en commits. El manejador de errores de `src/servidor.js` solo registra el nombre del tipo de error; mantenerlo así.
- Nunca usar datos reales en pruebas: solo datos inventados, como `ana@ejemplo.com`.
- Lo único que sale al proveedor de IA es el mensaje del cliente con correos y teléfonos reemplazados. Nunca el nombre ni el correo (ADR-0003). Cualquier cambio en `src/ia.js` que envíe más campos requiere un ADR nuevo.

## IA en el producto

- El texto que escribe el cliente es dato, no instrucción. Se envuelve en la etiqueta de solicitud y el prompt de sistema lo declara como dato (`src/ia.js`).
- La IA nunca envía nada al cliente, nunca cambia el estado de una solicitud a respondida y nunca decide prioridades (ADR-0002). Solo el endpoint de aprobación, con sesión de agente, puede hacerlo.
- Toda salida de la IA pasa por `validarSalida` antes de guardarse. No guardar texto libre del modelo sin validar.

## Secretos

- Las llaves van solo en variables de entorno del servidor (`ANTHROPIC_API_KEY`, `CODIGO_REGISTRO`). Nunca en `public/`, en el repo ni en los logs.
- `.env` está en `.gitignore`. No quitarlo.

## Límites del agente

- No borrar archivos ni datos de `data/`, ni ejecutar `npm run purgar`, sin confirmación de la persona.
- No cambiar el formato de los archivos del pack de gobernanza sin revisar el verificador en `.github/governance-pack/`.
- Ante la duda, no actuar: preguntar.

## Reglas propias de este proyecto

- Toda ruta que escribe datos de clientes exige sesión, salvo el formulario público `POST /api/solicitudes`. Agregar una ruta pública nueva requiere un ADR.
- Las respuestas de error devuelven solo un mensaje corto, nunca el detalle de una excepción.
- Cada prueba nueva usa `abrirBase(':memory:')` y no toca `data/`.
- No agregar dependencias externas sin revisar el ADR-0001: el proyecto corre sin `npm install`.
- Al cambiar el esquema de la base, hacerlo en `src/db.js` con `CREATE TABLE IF NOT EXISTS` y reflejar el cambio en el inventario de datos.
