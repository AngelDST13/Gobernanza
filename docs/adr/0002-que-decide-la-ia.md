# ADR-0002: La IA sugiere; una persona decide y aprueba cada respuesta

- Estado: Aceptado
- Fecha: 2026-11-13
- Decide: Angel, dueño del proyecto (responde por lo que la IA puede y no puede hacer)

## Contexto

La bandeja recibe solicitudes de clientes por el formulario público. La IA (ver ADR-0001) hace dos cosas: sugiere una categoría y escribe un borrador de respuesta. Ambas salidas las ve un agente. Una respuesta equivocada o una promesa de reembolso comprometen a la empresa, así que la decisión la toma una persona.

## Decisión

La IA sí hace:

- Sugerir una de cuatro categorías: `facturacion`, `tecnico`, `cuenta` u `otro`. La sugerencia solo se muestra al agente. Ninguna regla enruta, prioriza ni cierra solicitudes según la categoría.
- Escribir un borrador de hasta 2000 caracteres, que se guarda en `borrador_sugerido`.

La IA nunca hace:

- Enviar un correo ni ninguna respuesta al cliente. El código no tiene ninguna ruta de salida hacia el cliente.
- Cambiar el estado de una solicitud a respondida. Solo el endpoint de aprobación lo hace, con sesión de agente.
- Asignar prioridad, decidir reembolsos, prometer plazos o montos.
- Decidir sobre una persona: no puntúa, no descarta solicitudes y no filtra clientes.

Quién confirma: un agente con sesión iniciada revisa el borrador, escribe o edita la respuesta final (entre 5 y 4000 caracteres) y la aprueba. Sin esa aprobación, la solicitud queda pendiente.

Validación de la salida de la IA: la categoría debe estar en la lista cerrada, y el borrador debe ser texto no vacío de hasta 2000 caracteres. Cualquier otra salida se descarta y la solicitud queda sin borrador.

## Alternativas descartadas

- Responder solo cuando la IA tenga alta confianza: descartado. El modelo no entrega una medida de confianza confiable, y un error llegaría al cliente sin revisión. Es el patrón del caso Air Canada (2024).
- Que la IA asigne prioridad para ordenar la bandeja: descartado. Ordenar personas por una puntuación automática es lo que falló en Salta y en Países Bajos. La bandeja se ordena por fecha.
- Enrutar por categoría a distintos equipos: descartado por ahora. Requiere un ADR propio.

## Consecuencias

- Cada solicitud necesita un paso humano. Lo que se gana: nadie recibe una respuesta que una persona no revisó.
- El agente puede aprobar sin leer el borrador. La interfaz lo precarga, pero la API no puede comprobar que alguien lo leyó. Queda como riesgo R3 en el registro.
- Si el proveedor de IA falla, la solicitud se guarda igual y el trabajo sigue en manos de la persona.

## Cómo se verifica

- `test/app.test.js`, «la IA no puede dejar una solicitud respondida»: aprobar sin sesión devuelve 401 y aprobar sin texto devuelve 400.
- `test/app.test.js`, «un agente aprueba la respuesta y queda registrado quién la aprobó»: el cambio a respondida exige sesión y guarda `aprobado_por`.
- `test/app.test.js`, «si el modelo devuelve algo inválido, no hay borrador»: una salida fuera de formato no llega a la base.
- En el código, `aprobarRespuesta` en `src/solicitudes.js` es el único lugar que escribe el estado `respondida`. Se puede comprobar con `grep -rn "respondida" src/`.
