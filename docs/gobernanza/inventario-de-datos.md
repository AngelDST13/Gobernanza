# Inventario de datos

No se puede gobernar lo que no se sabe que se tiene. Una fila por cada dato que el sistema guarda, recibe o envía a un tercero, incluido el proveedor del modelo de IA.

| Dato | ¿Personal? | Categoría (Ley 8968, art. 9) | De dónde viene | Dónde se guarda | ¿Sale a un tercero? ¿A quién? | Cuánto se conserva | Quién puede verlo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nombre del cliente | Sí | Acceso restringido | Formulario público | Tabla solicitudes, columna nombre | No | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Correo del cliente | Sí | Acceso restringido | Formulario público | Tabla solicitudes, columna correo | No: nunca se envía al proveedor de IA | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Mensaje del cliente | Sí | Sensible | Formulario público | Tabla solicitudes, columna mensaje | Sí: a Anthropic, solo si hay clave de API, con correos y teléfonos reemplazados | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Fecha de consentimiento | Sí | Acceso restringido | Casilla del formulario público | Tabla solicitudes, columna consentimiento_en | No | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Categoría sugerida por la IA | No | No aplica | Respuesta del modelo, validada | Tabla solicitudes, columna categoria_sugerida | No | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Borrador sugerido por la IA | Sí | Acceso restringido | Respuesta del modelo, validada | Tabla solicitudes, columna borrador_sugerido | No | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Respuesta final aprobada | Sí | Acceso restringido | Escrita y aprobada por un agente | Tabla solicitudes, columna respuesta_final | No | Hasta 365 días (RETENCION_DIAS) | Agentes con sesión iniciada |
| Correo y nombre del agente | Sí | Acceso restringido | Registro con código de acceso | Tabla usuarios | No | Mientras exista la cuenta. Pendiente: no hay baja de cuentas | Solo el propio agente en la base |
| Clave del agente | Sí | Acceso restringido | Escrita por el agente al registrarse | Tabla usuarios, columna hash_clave (solo el hash scrypt) | No | Mientras exista la cuenta | Nadie: solo se compara el hash |
| Token de sesión | No | No aplica | Generado al iniciar sesión | Tabla sesiones, solo el hash SHA-256 | No | 8 horas | Nadie: solo se compara el hash |
| Registro de llamadas a la IA | No | No aplica | Generado por la app | Tabla registros_ia (proveedor, modelo, duración, resultado) | No | Sin purga automática. Pendiente | Administración del servidor |
| Errores del servidor | No | No aplica | Generados por la app | Salida de consola del proceso | No | Según el servidor donde corra. Pendiente | Quien administra el servidor |

<!--
Categorías de la Ley 8968 (art. 9):
- Sensibles: origen racial o étnico, opiniones políticas, convicciones religiosas, salud,
  vida y orientación sexual; la definición del art. 3 incluye la condición socioeconómica
  y la información biomédica o genética. Si aparece uno, expliquen en un ADR por qué lo necesitan.
- Acceso restringido: de interés solo para la persona o la administración (correo, teléfono, dirección).
- Acceso irrestricto: los que constan en bases públicas de acceso general.
- Crediticios: comportamiento crediticio de la persona.
-->

## Lo que NO recolectamos

- Cédula, fecha de nacimiento y dirección: el formulario no los pide. No los necesitamos para responder una solicitud.
- Datos de pago o tarjetas: el sistema no cobra. No hay pasarela de pagos.
- Dirección IP ni ubicación: la app no guarda la IP de quien escribe ni su ubicación.
- Historial de navegación ni cookies de seguimiento: la interfaz no usa cookies ni analítica de terceros.
