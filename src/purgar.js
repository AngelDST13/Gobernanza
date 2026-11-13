// Uso manual: npm run purgar
// Borra las solicitudes más antiguas que RETENCION_DIAS.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirBase } from './db.js'
import { purgarAntiguas } from './solicitudes.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = abrirBase(process.env.DB_PATH ?? join(RAIZ, 'data', 'gobernanza.db'))
const dias = Number(process.env.RETENCION_DIAS ?? 365)
console.log(`Solicitudes eliminadas por retención (${dias} días): ${purgarAntiguas(db, dias)}`)
