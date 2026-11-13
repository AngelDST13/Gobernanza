import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registrarAgente, iniciarSesion, usuarioDesdeToken, cerrarSesion, ErrorApp } from './auth.js'
import {
  crearSolicitud, listarSolicitudes, aprobarRespuesta, eliminarSolicitud, exportarPorCorreo,
} from './solicitudes.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CARPETA_PUBLICA = join(RAIZ, 'public')
const LIMITE_CUERPO = 16 * 1024
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

const leerCuerpo = (req) =>
  new Promise((resolver, rechazar) => {
    let tamano = 0
    const trozos = []
    req.on('data', (trozo) => {
      tamano += trozo.length
      if (tamano > LIMITE_CUERPO) {
        rechazar(new ErrorApp(413, 'el cuerpo de la petición es demasiado grande'))
        req.destroy()
        return
      }
      trozos.push(trozo)
    })
    req.on('end', () => {
      if (trozos.length === 0) return resolver({})
      try {
        resolver(JSON.parse(Buffer.concat(trozos).toString('utf8')))
      } catch {
        rechazar(new ErrorApp(400, 'JSON inválido'))
      }
    })
    req.on('error', rechazar)
  })

const responder = (res, status, cuerpo) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(cuerpo))
}

const servirArchivo = async (res, rutaPedida) => {
  const nombre = rutaPedida === '/' ? 'index.html' : rutaPedida.slice(1)
  // Solo archivos planos dentro de public/: se bloquean rutas con ".." o subcarpetas.
  if (!/^[\w.-]+$/.test(nombre)) return responder(res, 404, { error: 'no encontrado' })
  try {
    const contenido = await readFile(join(CARPETA_PUBLICA, nombre))
    res.writeHead(200, { 'content-type': TIPOS[extname(nombre)] ?? 'application/octet-stream' })
    res.end(contenido)
  } catch {
    responder(res, 404, { error: 'no encontrado' })
  }
}

/**
 * Crea el servidor. `config` trae: codigoRegistro, apiKey, modelo.
 * No lee variables de entorno: eso lo hace src/index.js. Así las pruebas son independientes.
 */
export const crearServidor = (db, config = {}) => {
  const tokenDe = (req) => req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null

  const exigirUsuario = (req) => {
    const usuario = usuarioDesdeToken(db, tokenDe(req))
    if (!usuario) throw new ErrorApp(401, 'inicia sesión para continuar')
    return usuario
  }

  const rutas = [
    ['POST', /^\/api\/auth\/registro$/, async (req) => {
      const cuerpo = await leerCuerpo(req)
      return [201, registrarAgente(db, cuerpo, config.codigoRegistro)]
    }],
    ['POST', /^\/api\/auth\/login$/, async (req) => {
      const cuerpo = await leerCuerpo(req)
      return [200, iniciarSesion(db, cuerpo)]
    }],
    ['POST', /^\/api\/auth\/salir$/, async (req) => {
      cerrarSesion(db, tokenDe(req))
      return [200, { ok: true }]
    }],
    ['GET', /^\/api\/solicitudes$/, async (req) => {
      exigirUsuario(req)
      return [200, listarSolicitudes(db)]
    }],
    ['POST', /^\/api\/solicitudes$/, async (req) => {
      // Ruta pública: la usa el cliente desde el formulario.
      const cuerpo = await leerCuerpo(req)
      return [201, await crearSolicitud(db, cuerpo, { apiKey: config.apiKey, modelo: config.modelo })]
    }],
    ['POST', /^\/api\/solicitudes\/(\d+)\/aprobar$/, async (req, [, id]) => {
      const usuario = exigirUsuario(req)
      const cuerpo = await leerCuerpo(req)
      return [200, aprobarRespuesta(db, { id: Number(id), respuesta: cuerpo.respuesta, usuario })]
    }],
    ['DELETE', /^\/api\/solicitudes\/(\d+)$/, async (req, [, id]) => {
      exigirUsuario(req)
      return [200, eliminarSolicitud(db, Number(id))]
    }],
    ['GET', /^\/api\/personas\/([^/]+)\/exportar$/, async (req, [, correo]) => {
      exigirUsuario(req)
      return [200, exportarPorCorreo(db, decodeURIComponent(correo))]
    }],
    ['GET', /^\/api\/salud$/, async () => [200, { ok: true }]],
  ]

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    try {
      if (!url.pathname.startsWith('/api/') && req.method === 'GET') {
        return await servirArchivo(res, url.pathname)
      }
      for (const [metodo, patron, manejador] of rutas) {
        const coincide = url.pathname.match(patron)
        if (coincide && metodo === req.method) {
          const [status, cuerpo] = await manejador(req, coincide)
          return responder(res, status, cuerpo)
        }
      }
      responder(res, 404, { error: 'ruta no encontrada' })
    } catch (error) {
      if (error instanceof ErrorApp) return responder(res, error.status, { error: error.message })
      // No se devuelve el detalle del error al cliente: podría contener datos personales.
      console.error('error interno:', error.name)
      responder(res, 500, { error: 'error interno' })
    }
  })
}
