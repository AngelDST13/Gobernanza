// Punto de entrada. Conecta el store, la sesión, el enrutador y la barra de navegación.
// Las vistas se importan solo cuando se visitan (carga diferida por ruta).

import { crear } from './util/dom.js'
import { crearStore } from './util/store.js'
import { avisar } from './util/avisos.js'
import { fijarToken, alSesionExpirada, pedir } from './api.js'
import { crearRouter } from './router.js'

const CLAVE_SESION = 'gobernanza.sesion'

// sessionStorage puede estar bloqueado (modo privado, políticas del navegador).
// Si no está disponible, la sesión dura lo que la pestaña, sin romper la app.
const leerSesion = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION))
  } catch {
    return null
  }
}
const guardarSesion = (sesion) => {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
  } catch {
    // Sin almacenamiento: el usuario tendrá que volver a entrar al recargar.
  }
}
const borrarSesion = () => {
  try {
    sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // Nada que borrar.
  }
}

const store = crearStore({ sesion: leerSesion(), ruta: '/' })
if (store.obtener().sesion) fijarToken(store.obtener().sesion.token)

const iniciarSesion = (sesion) => {
  fijarToken(sesion.token)
  guardarSesion(sesion)
  store.actualizar({ sesion })
  router.ir('/bandeja')
}

const terminarSesion = () => {
  fijarToken(null)
  borrarSesion()
  store.actualizar({ sesion: null })
}

const cerrarSesion = async () => {
  await pedir('/api/auth/salir', { metodo: 'POST' }).catch(() => {})
  terminarSesion()
  router.ir('/acceso')
}

// Si el servidor rechaza el token (venció o se cerró en otro lugar), se cierra la sesión local.
alSesionExpirada(() => {
  terminarSesion()
  avisar('Tu sesión venció. Inicia sesión de nuevo.', 'error')
  router.ir('/acceso')
})

const rutas = {
  '/': { cargar: async () => (await import('./vistas/publica.js')).vistaPublica() },
  '/acceso': {
    cargar: async () => (await import('./vistas/acceso.js')).vistaAcceso({ alIniciar: iniciarSesion }),
  },
  '/bandeja': {
    privada: true,
    cargar: async () => (await import('./vistas/bandeja.js')).vistaBandeja(),
  },
}

const router = crearRouter({
  rutas,
  contenedor: document.getElementById('principal'),
  hayUsuario: () => Boolean(store.obtener().sesion),
  alCambiarRuta: (ruta) => store.actualizar({ ruta }),
})

// Barra de navegación: se redibuja solo cuando cambian la sesión o la ruta.
const navegacion = document.getElementById('navegacion')

const enlace = (href, texto, activo) =>
  crear('a', { href, class: 'enlace', 'aria-current': activo ? 'page' : false }, texto)

const pintarNavegacion = ({ sesion, ruta }) => {
  const elementos = [enlace('#/', 'Escríbenos', ruta === '/')]
  if (sesion) {
    elementos.push(
      enlace('#/bandeja', 'Bandeja', ruta === '/bandeja'),
      crear('span', { class: 'usuario' }, sesion.usuario.nombre),
      crear('button', { type: 'button', class: 'boton boton-secundario', onclick: cerrarSesion }, 'Salir'),
    )
  } else {
    elementos.push(enlace('#/acceso', 'Acceso de agentes', ruta === '/acceso'))
  }
  navegacion.replaceChildren(...elementos)
}

store.suscribir(pintarNavegacion)
pintarNavegacion(store.obtener())
router.iniciar()
