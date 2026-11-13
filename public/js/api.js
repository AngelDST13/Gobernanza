/**
 * Único punto de comunicación con el servidor.
 * Las vistas nunca llaman a fetch directamente: así el token, los errores
 * y la expiración de sesión se manejan en un solo lugar.
 */

export class ErrorApi extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.status = status
  }
}

let token = null
let alExpirarSesion = () => {}

export const fijarToken = (nuevo) => {
  token = nuevo
}

/** Se llama cuando el servidor responde 401 con un token que ya tenía el cliente. */
export const alSesionExpirada = (callback) => {
  alExpirarSesion = callback
}

/**
 * Hace una petición JSON. Lanza ErrorApi con el mensaje del servidor.
 * `senal` (AbortSignal) permite cancelar peticiones que ya no hacen falta,
 * por ejemplo cuando el usuario cambia de filtro antes de que llegue la respuesta.
 */
export const pedir = async (ruta, { metodo = 'GET', cuerpo, senal } = {}) => {
  const cabeceras = {}
  if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json'
  if (token) cabeceras.authorization = `Bearer ${token}`

  let respuesta
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: senal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ErrorApi(0, 'No hay conexión con el servidor. Intenta de nuevo.')
  }

  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alExpirarSesion()
    throw new ErrorApi(respuesta.status, datos.error ?? 'Ocurrió un error inesperado.')
  }
  return datos
}

export const esCancelada = (error) => error?.name === 'AbortError'
