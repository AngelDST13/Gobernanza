/**
 * Enrutador por hash (#/ruta). Sin dependencias.
 *
 * Cada ruta es { cargar, privada }:
 *  - cargar: función async que devuelve el nodo de la vista. Se importa solo cuando se visita.
 *  - privada: si es true, sin sesión se redirige a /acceso.
 *
 * Agregar una pantalla = agregar una entrada aquí.
 */
export const crearRouter = ({ rutas, contenedor, hayUsuario, alCambiarRuta }) => {
  let rutaActual = null

  const resolver = async () => {
    const [camino] = (location.hash.replace(/^#/, '') || '/').split('?')
    const definicion = rutas[camino] ?? rutas['/']

    if (definicion.privada && !hayUsuario()) {
      location.hash = '#/acceso'
      return
    }

    rutaActual = camino
    alCambiarRuta(camino)
    const vista = await definicion.cargar()
    // Si el usuario navegó mientras se cargaba la vista, esta respuesta ya no aplica.
    if (rutaActual !== camino) return
    contenedor.replaceChildren(vista)
    contenedor.focus()
  }

  window.addEventListener('hashchange', resolver)
  return { iniciar: resolver, ir: (camino) => (location.hash = `#${camino}`) }
}
