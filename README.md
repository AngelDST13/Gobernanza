# Bandeja de soporte con IA

Un formulario público recibe solicitudes de clientes. La IA sugiere una categoría y un borrador de respuesta. Un agente revisa, escribe o edita la respuesta final y la aprueba. **La IA nunca responde sola.**

Proyecto de práctica para el taller de gobernanza de IA y datos. El pack de gobernanza está en [`docs/`](docs/) y las reglas para agentes de código en [`AGENTS.md`](AGENTS.md).

## Requisitos

- Node.js 22.13 o superior (usa el módulo `node:sqlite` integrado).
- No necesita `npm install`: no tiene dependencias externas.

## Arranque

```bash
cp .env.example .env     # en Windows: copy .env.example .env
# edita .env: pon un CODIGO_REGISTRO propio
npm start
```

Luego abre http://localhost:3000.

- El formulario «Escríbenos» es público.
- Para entrar como agente, primero crea una cuenta con `POST /api/auth/registro`, enviando el `CODIGO_REGISTRO` en el cuerpo. Sin ese código no se pueden crear cuentas.

## Variables de entorno

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `3000` |
| `DB_PATH` | Archivo de la base SQLite | `data/gobernanza.db` |
| `CODIGO_REGISTRO` | Código para crear cuentas de agente. Sin él, no hay registro | ninguno |
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic. Sin ella se usan reglas locales y no sale ningún dato | vacía |
| `MODELO_IA` | Modelo que se usa con la clave | `claude-haiku-5-5` |
| `RETENCION_DIAS` | Días que se conservan las solicitudes | `365` |

## Pruebas

```bash
npm test
```

Las pruebas usan una base en memoria y datos inventados. No llaman a ningún proveedor de IA.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Arranca el servidor |
| `npm test` | Corre las pruebas |
| `npm run purgar` | Borra las solicitudes más viejas que `RETENCION_DIAS` |

## Estructura

```
src/
  index.js        arranque: lee .env, abre la base, programa la purga diaria
  servidor.js     rutas HTTP y control de acceso
  auth.js         cuentas de agente, claves con scrypt, sesiones
  solicitudes.js  crear, listar, aprobar, borrar, exportar y purgar solicitudes
  ia.js           sugerencias de la IA, redacción de datos y validación de la salida
  db.js           esquema de la base SQLite
  purgar.js       purga manual
public/           interfaz (HTML, JavaScript y CSS sin frameworks)
test/app.test.js  pruebas
docs/             pack de gobernanza: ADRs, inventario de datos y registro de riesgos
AGENTS.md         reglas para agentes de código
```

## Endpoints

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| POST | `/api/solicitudes` | Público | Recibe una solicitud y guarda la sugerencia de la IA |
| POST | `/api/auth/registro` | Código de registro | Crea una cuenta de agente |
| POST | `/api/auth/login` | Público | Inicia sesión y devuelve un token |
| POST | `/api/auth/salir` | Token | Cierra la sesión |
| GET | `/api/solicitudes` | Agente | Lista las solicitudes |
| POST | `/api/solicitudes/:id/aprobar` | Agente | Aprueba la respuesta final |
| DELETE | `/api/solicitudes/:id` | Agente | Borra una solicitud (derecho de supresión) |
| GET | `/api/personas/:correo/exportar` | Agente | Exporta lo guardado de un correo (derecho de acceso) |
| GET | `/api/salud` | Público | Estado del servicio |

## Limitaciones conocidas

Estas son cosas que el proyecto todavía no hace. Están registradas en [`docs/gobernanza/registro-de-riesgos.md`](docs/gobernanza/registro-de-riesgos.md):

- No hay límite de intentos de inicio de sesión ni límite de envíos del formulario.
- No hay copia de respaldo de la base.
- La purga no alcanza a los registros de IA ni a las cuentas de agente.
- Nada en el código comprueba que el agente leyó el borrador antes de aprobarlo.
- No hay despliegue definido: corre en un solo servidor local.
