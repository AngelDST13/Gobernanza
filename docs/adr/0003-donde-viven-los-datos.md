# ADR-0003: Los datos viven en un archivo SQLite del servidor, con purga automática y sin servicios en la nube

- Estado: Aceptado
- Fecha: 2026-11-13
- Decide: Angel, dueño del proyecto

## Contexto

La bandeja guarda solicitudes de clientes, cuentas de agentes y sesiones. El proyecto corre en un solo servidor y no tiene equipo de operaciones. En Costa Rica ya hubo filtraciones de datos de residentes, así que el almacenamiento y el tránsito de los datos importan desde el diseño.

## Decisión

Dónde se guardan:

- Una base SQLite en un archivo del servidor, en la ruta `DB_PATH` (por defecto `data/gobernanza.db`). No hay base de datos en la nube.
- Cuatro tablas: `usuarios`, `sesiones`, `solicitudes` y `registros_ia`.
- En el navegador, el token de sesión va en `sessionStorage`, que se borra al cerrar la pestaña. El navegador no guarda datos de los clientes.

Qué sale del servidor:

- Solo a `api.anthropic.com`, y solo si `ANTHROPIC_API_KEY` está definida.
- Sale el mensaje del cliente con los correos y teléfonos reemplazados por `[email]` y `[telefono]`. El nombre y el correo nunca salen.

Controles aplicados:

- Claves de agentes con scrypt y sal aleatoria. Nunca en texto plano.
- Tokens de sesión: se guarda solo su hash SHA-256 y duran 8 horas.
- Las cuentas de agente solo se crean con el código `CODIGO_REGISTRO`.
- Las respuestas de error no muestran detalles internos.
- Los logs del servidor solo muestran el nombre del tipo de error, no su contenido.

Plazos:

- Solicitudes: `RETENCION_DIAS` (365 por defecto). Se borran solas una vez al día y también con `npm run purgar`.
- Derecho de acceso y de supresión: endpoints para exportar y borrar las solicitudes de un correo.

Ubicación y soberanía: el archivo queda en el disco del servidor donde corra la app. Pendiente: definir el servidor y su región. Pendiente: confirmar en qué región procesa Anthropic los datos que recibe.

## Alternativas descartadas

- Base de datos administrada en la nube (Supabase, Firebase): descartada por ahora. Agrega un tercero que guarda datos personales y exige un contrato de encargado de tratamiento que todavía no existe.
- Enviar el mensaje completo al proveedor de IA: descartado. Nombre y correo no son necesarios para redactar un borrador.
- Cifrar las claves de agentes de forma reversible: descartado. Con hash basta para verificar la clave.

## Consecuencias

- Es simple de respaldar y de borrar, pero el archivo es un solo punto de falla. Pendiente: copia de respaldo programada.
- La purga de solicitudes no alcanza a `registros_ia` ni a las cuentas de agente. Quedan como Pendiente en el registro de riesgos.
- La redacción solo cubre correos y teléfonos. Un dato sensible escrito en el mensaje sí puede salir al proveedor. Por eso el inventario marca el mensaje como sensible y este ADR lo explica.

## Cómo se verifica

- `test/app.test.js`, «la clave se guarda con hash, nunca en texto plano».
- `test/app.test.js`, «purgarAntiguas borra solo lo más viejo que la retención».
- `test/app.test.js`, «con clave, el texto enviado al proveedor va redactado y dentro de la etiqueta de datos».
- `test/app.test.js`, «no se puede crear cuenta sin el código de registro».
- `test/app.test.js`, «derecho de acceso: exportar lo que se guarda de un correo» y «derecho de supresión: borrar una solicitud».
