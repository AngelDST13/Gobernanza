import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

const DURACION_SESION_MS = 8 * 60 * 60 * 1000 // 8 horas
const MIN_LONGITUD_CLAVE = 10

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

/** Guarda la clave como `scrypt$sal$hash`. Nunca se guarda en texto plano. */
export const hashearClave = (clave) => {
  const sal = randomBytes(16).toString('hex')
  const hash = scryptSync(clave, sal, 64).toString('hex')
  return `scrypt$${sal}$${hash}`
}

export const verificarClave = (clave, guardado) => {
  const [algoritmo, sal, hashEsperado] = guardado.split('$')
  if (algoritmo !== 'scrypt' || !sal || !hashEsperado) return false
  const hash = scryptSync(clave, sal, 64)
  const esperado = Buffer.from(hashEsperado, 'hex')
  return esperado.length === hash.length && timingSafeEqual(hash, esperado)
}

export const validarRegistro = ({ correo, nombre, clave }) => {
  const errores = []
  if (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('correo inválido')
  if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 100) errores.push('nombre inválido')
  if (typeof clave !== 'string' || clave.length < MIN_LONGITUD_CLAVE) {
    errores.push(`la clave necesita al menos ${MIN_LONGITUD_CLAVE} caracteres`)
  }
  return errores
}

/** Crea una cuenta de agente. El código de registro evita que cualquiera entre. */
export const registrarAgente = (db, { correo, nombre, clave, codigo }, codigoEsperado) => {
  if (!codigoEsperado) throw new ErrorApp(403, 'el registro está desactivado')
  if (codigo !== codigoEsperado) throw new ErrorApp(403, 'código de registro incorrecto')
  const errores = validarRegistro({ correo, nombre, clave })
  if (errores.length) throw new ErrorApp(400, errores.join('; '))
  try {
    const info = db
      .prepare('INSERT INTO usuarios (correo, nombre, hash_clave, creado_en) VALUES (?, ?, ?, ?)')
      .run(correo.toLowerCase(), nombre.trim(), hashearClave(clave), new Date().toISOString())
    return { id: Number(info.lastInsertRowid), correo: correo.toLowerCase(), nombre: nombre.trim() }
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw new ErrorApp(409, 'ese correo ya tiene cuenta')
    throw error
  }
}

export const iniciarSesion = (db, { correo, clave }) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(String(correo ?? '').toLowerCase())
  // Se verifica igual aunque el usuario no exista, para no revelar qué correos hay.
  const valido = usuario ? verificarClave(String(clave ?? ''), usuario.hash_clave) : (hashearClave('x'), false)
  if (!valido) throw new ErrorApp(401, 'correo o clave incorrectos')

  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + DURACION_SESION_MS).toISOString()
  db.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, ?)')
    .run(hashToken(token), usuario.id, expira)
  return { token, expira_en: expira, usuario: { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre } }
}

/** Devuelve el usuario dueño del token, o null si no existe o ya venció. */
export const usuarioDesdeToken = (db, token) => {
  if (!token) return null
  const fila = db.prepare(`
    SELECT u.id, u.correo, u.nombre, s.expira_en
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ?
  `).get(hashToken(token))
  if (!fila) return null
  if (new Date(fila.expira_en) < new Date()) {
    db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(hashToken(token))
    return null
  }
  return { id: fila.id, correo: fila.correo, nombre: fila.nombre }
}

export const cerrarSesion = (db, token) => {
  if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(hashToken(token))
}

/** Error con código HTTP, para que el servidor responda con el estado correcto. */
export class ErrorApp extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.status = status
  }
}
