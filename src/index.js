import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirBase } from './db.js'
import { crearServidor } from './servidor.js'
import { purgarAntiguas } from './solicitudes.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// Carga .env sin dependencias. Las variables ya definidas en el sistema tienen prioridad.
const rutaEnv = join(RAIZ, '.env')
if (existsSync(rutaEnv)) {
  for (const linea of readFileSync(rutaEnv, 'utf8').split('\n')) {
    const coincide = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (coincide && process.env[coincide[1]] === undefined) process.env[coincide[1]] = coincide[2]
  }
}

const db = abrirBase(process.env.DB_PATH ?? join(RAIZ, 'data', 'gobernanza.db'))
const servidor = crearServidor(db, {
  codigoRegistro: process.env.CODIGO_REGISTRO || null,
  apiKey: process.env.ANTHROPIC_API_KEY || null,
  modelo: process.env.MODELO_IA || 'claude-haiku-5-5',
})

// Purga automática de solicitudes vencidas, una vez al día.
const dias = Number(process.env.RETENCION_DIAS ?? 365)
setInterval(() => {
  const borradas = purgarAntiguas(db, dias)
  if (borradas) console.log(`purga: ${borradas} solicitud(es) vencidas eliminadas`)
}, 24 * 60 * 60 * 1000).unref()

const puerto = Number(process.env.PORT ?? 3000)
servidor.listen(puerto, () => {
  console.log(`Bandeja de soporte en http://localhost:${puerto}`)
  console.log(process.env.ANTHROPIC_API_KEY ? 'IA: Anthropic' : 'IA: reglas locales (sin proveedor externo)')
})
