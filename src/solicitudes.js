import { ErrorApp } from './auth.js'
import { sugerir } from './ia.js'

const MAX_MENSAJE = 2000

const validarSolicitud = ({ nombre, correo, mensaje }) => {
  const errores = []
  if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 100) errores.push('nombre inválido')
  if (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('correo inválido')
  if (typeof mensaje !== 'string' || mensaje.trim().length < 5 || mensaje.length > MAX_MENSAJE) {
    errores.push(`el mensaje debe tener entre 5 y ${MAX_MENSAJE} caracteres`)
  }
  return errores
}

/** Guarda la solicitud y, si hay IA configurada, guarda también su sugerencia. */
export const crearSolicitud = async (db, datos, opciones = {}) => {
  const errores = validarSolicitud(datos)
  if (errores.length) throw new ErrorApp(400, errores.join('; '))

  const ahora = new Date().toISOString()
  const info = db
    .prepare('INSERT INTO solicitudes (nombre, correo, mensaje, creado_en) VALUES (?, ?, ?, ?)')
    .run(datos.nombre.trim(), datos.correo.trim().toLowerCase(), datos.mensaje.trim(), ahora)
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

export const listarSolicitudes = (db) =>
  db.prepare(`
    SELECT id, nombre, correo, mensaje, categoria_sugerida, borrador_sugerido,
           estado, respuesta_final, creado_en, respondida_en
    FROM solicitudes ORDER BY creado_en DESC
  `).all()

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
