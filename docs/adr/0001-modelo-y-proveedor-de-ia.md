# ADR-0001: Claude por la API de Anthropic, llamado solo desde el servidor, con reglas locales como respaldo

- Estado: Aceptado
- Fecha: 2026-11-13
- Decide: Angel, dueño del proyecto

## Contexto

La bandeja necesita, por cada solicitud de cliente, una categoría sugerida y un borrador de respuesta en español. El texto de entrada es corto (máximo 2000 caracteres). El proyecto es pequeño, no tiene presupuesto para infraestructura de modelos y debe poder correr sin clave de API, para desarrollo y pruebas.

## Decisión

- Proveedor: Anthropic, mediante la Messages API (`https://api.anthropic.com/v1/messages`) con la versión `2023-06-01`.
- Modelo: el valor de la variable `MODELO_IA`. Por defecto `claude-haiku-5-5`, porque la tarea es corta y una persona revisa cada resultado antes de usarlo.
- Dónde se llama: solo desde el servidor, en `src/ia.js`. La clave `ANTHROPIC_API_KEY` vive en variables de entorno y nunca llega al navegador.
- Límites por llamada: `max_tokens` de 600 y tiempo máximo de 15 segundos.
- Sin clave: la app usa reglas locales por palabras clave y no envía nada a ningún proveedor. Es el modo por defecto para desarrollo y pruebas.
- Sin dependencias: se usa `fetch` nativo de Node. No hay SDK instalado.

## Alternativas descartadas

- Modelo propio en el servidor: descartado. Requiere GPU o un servicio administrado, y operación que el proyecto no puede sostener.
- Solo reglas locales: descartado para producción. Clasifican por palabras clave y no escriben borradores útiles. Se mantienen como respaldo y para pruebas.
- Otro proveedor (OpenAI, Google): no se comparó en profundidad. Se eligió Anthropic porque el equipo ya lo usa. Queda como Pendiente comparar costo y calidad.
- SDK oficial de Anthropic: descartado por ahora para no agregar dependencias. Si la integración crece, se puede reconsiderar con un ADR nuevo.

## Consecuencias

- Todo lo que devuelve el modelo llega como texto no confiable y se valida antes de guardarse (ver ADR-0002).
- Cada solicitud tiene un costo que todavía no se ha medido. Pendiente: calcular el costo mensual con volumen real.
- La duración de cada llamada se guarda en la tabla `registros_ia`, así que la latencia se puede medir.
- Si la API no responde, la solicitud se guarda igual, sin borrador. El formulario no se bloquea.

## Cómo se verifica

- `test/app.test.js`, «con clave, el texto enviado al proveedor va redactado y dentro de la etiqueta de datos»: comprueba que el correo no aparece en lo que se envía.
- `test/app.test.js`, «sin clave de IA se usan reglas locales y no se llama a ningún proveedor»: comprueba que sin clave no hay llamadas de red.
- `test/app.test.js`, «si el proveedor falla, la solicitud se acepta igual y sin borrador».
- En la base, la tabla `registros_ia` guarda proveedor, modelo, duración y resultado de cada llamada.
