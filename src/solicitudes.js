import { ErrorApp } from './auth.js'
import { sugerir } from './ia.js'

const MAX_MENSAJE = 2000

// La casilla del formulario envía «on»; una API puede enviar true. Cualquier otra cosa no cuenta como aceptación.
const CONSENTIMIENTO_ACEPTADO = [true, 'on', 'true']

const validarSolicitud = ({ nombre, correo, mensaje, consentimiento }) => {
  const errores = []
  if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 100) errores.push('nombre inválido')
  if (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('correo inválido')
  if (typeof mensaje !== 'string' || mensaje.trim().length < 5 || mensaje.length > MAX_MENSAJE) {
    errores.push(`el mensaje debe tener entre 5 y ${MAX_MENSAJE} caracteres`)
  }
  if (!CONSENTIMIENTO_ACEPTADO.includes(consentimiento)) {
    errores.push('falta el consentimiento para guardar tu mensaje (Ley 8968, art. 5)')
  }
  return errores
}

/** Guarda la solicitud y, si hay IA configurada, guarda también su sugerencia. */
export const crearSolicitud = async (db, datos, opciones = {}) => {
  const errores = validarSolicitud(datos)
  if (errores.length) throw new ErrorApp(400, errores.join('; '))

  const ahora = new Date().toISOString()
  const info = db
    .prepare('INSERT INTO solicitudes (nombre, correo, mensaje, creado_en, consentimiento_en) VALUES (?, ?, ?, ?, ?)')
    .run(datos.nombre.trim(), datos.correo.trim().toLowerCase(), datos.mensaje.trim(), ahora, ahora)
  const id = Number(info.lastInsertRowid)

  const ia = await sugerir(datos.mensaje, opciones)
  db.prepare(`
    UPDATE solicitudes SET categoria_sugerida = ?, borrador_sugerido = ? WHERE id = ?
  `).run(ia.sugerencia?.categoria ?? null, ia.sugerencia?.borrador ?? null, id)
  db.prepare(`
    INSERT INTO registros_ia (solicitud_id, proveedor, modelo, duracion_ms, resultado, creado_en)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, ia.proveedor, ia.modelo, ia.duracion_ms, ia.resultado, new Date().toISOString())

  return { id, estado: 'pendiente' }
}

const LIMITE_POR_DEFECTO = 20
const LIMITE_MAXIMO = 50
const ESTADOS_VALIDOS = ['pendiente', 'respondida']

/** Lee un entero de la query string. Si no viene, usa el valor por defecto. */
const enteroDeQuery = (valor, porDefecto, min, max, nombre) => {
  if (valor === null || valor === '') return porDefecto
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw new ErrorApp(400, `${nombre} debe ser un entero entre ${min} y ${max}`)
  }
  return numero
}

// Escapa los comodines de LIKE para que la búsqueda sea literal.
const escaparLike = (texto) => texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)

/**
 * Lista paginada. Parámetros de la query: pagina, limite, estado, q.
 * Devuelve { datos, pagina, limite, total, paginas }.
 */
export const listarSolicitudes = (db, parametros = new URLSearchParams()) => {
  const pagina = enteroDeQuery(parametros.get('pagina'), 1, 1, 1_000_000, 'pagina')
  const limite = enteroDeQuery(parametros.get('limite'), LIMITE_POR_DEFECTO, 1, LIMITE_MAXIMO, 'limite')

  const estado = parametros.get('estado') || null
  if (estado !== null && !ESTADOS_VALIDOS.includes(estado)) {
    throw new ErrorApp(400, 'estado debe ser pendiente o respondida')
  }

  const q = (parametros.get('q') ?? '').trim()
  if (q.length > 100) throw new ErrorApp(400, 'la búsqueda no puede pasar de 100 caracteres')

  const condiciones = []
  const valores = []
  if (estado) {
    condiciones.push('estado = ?')
    valores.push(estado)
  }
  if (q) {
    condiciones.push("(nombre LIKE ? ESCAPE '\\' OR correo LIKE ? ESCAPE '\\')")
    const patron = `%${escaparLike(q)}%`
    valores.push(patron, patron)
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM solicitudes ${where}`).get(...valores)
  const datos = db.prepare(`
    SELECT id, nombre, correo, mensaje, categoria_sugerida, borrador_sugerido,
           estado, respuesta_final, creado_en, respondida_en
    FROM solicitudes ${where}
    ORDER BY creado_en DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...valores, limite, (pagina - 1) * limite)

  return {
    datos,
    pagina,
    limite,
    total: Number(total),
    paginas: Math.max(1, Math.ceil(Number(total) / limite)),
  }
}

/**
 * Una persona aprueba la respuesta final. La respuesta es obligatoria:
 * la IA no puede dejar una solicitud respondida por sí sola.
 */
export const aprobarRespuesta = (db, { id, respuesta, usuario }) => {
  const solicitud = db.prepare('SELECT id, estado FROM solicitudes WHERE id = ?').get(id)
  if (!solicitud) throw new ErrorApp(404, 'solicitud no encontrada')
  if (typeof respuesta !== 'string' || respuesta.trim().length < 5 || respuesta.length > 4000) {
    throw new ErrorApp(400, 'la respuesta debe tener entre 5 y 4000 caracteres')
  }
  db.prepare(`
    UPDATE solicitudes
    SET estado = 'respondida', respuesta_final = ?, aprobado_por = ?, respondida_en = ?
    WHERE id = ?
  `).run(respuesta.trim(), usuario.id, new Date().toISOString(), id)
  return { id, estado: 'respondida' }
}

/** Derecho de supresión: borra la solicitud. Sus registros de IA quedan sin vínculo a la persona. */
export const eliminarSolicitud = (db, id) => {
  const info = db.prepare('DELETE FROM solicitudes WHERE id = ?').run(id)
  if (info.changes === 0) throw new ErrorApp(404, 'solicitud no encontrada')
  return { id, eliminada: true }
}

/** Derecho de acceso: todo lo que la base guarda sobre un correo. */
export const exportarPorCorreo = (db, correo) =>
  db.prepare(`
    SELECT id, nombre, correo, mensaje, categoria_sugerida, estado, respuesta_final, creado_en, respondida_en
    FROM solicitudes WHERE correo = ? ORDER BY creado_en
  `).all(String(correo).trim().toLowerCase())

/** Retención: borra solicitudes más antiguas que `dias`. Devuelve cuántas borró. */
export const purgarAntiguas = (db, dias, ahora = new Date()) => {
  const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()
  const info = db.prepare('DELETE FROM solicitudes WHERE creado_en < ?').run(limite)
  return Number(info.changes)
}
