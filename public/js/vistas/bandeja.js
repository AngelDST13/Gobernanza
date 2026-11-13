import { crear } from '../util/dom.js'
import { pedir, esCancelada, ErrorApi } from '../api.js'
import { avisar } from '../util/avisos.js'
import { tarjetaSolicitud } from '../componentes/solicitud.js'
import { paginacion } from '../componentes/paginacion.js'

const TAMANO_PAGINA = 10
const ESPERA_BUSQUEDA_MS = 300

const opcion = (valor, texto) => crear('option', { value: valor }, texto)

/**
 * Bandeja del agente: filtros, búsqueda y paginación.
 * Cada cambio de filtro cancela la petición anterior, así la respuesta
 * que llega tarde nunca pisa la lista más reciente.
 */
export const vistaBandeja = () => {
  const filtros = { pagina: 1, estado: '', q: '' }
  let controlador = null
  let temporizador = null

  const resumen = crear('p', { class: 'nota', role: 'status' })
  const lista = crear('ul', { class: 'lista', 'aria-label': 'Solicitudes' })
  const pie = crear('div', { class: 'pie-lista' })

  const pintar = ({ datos, pagina, paginas, total }) => {
    resumen.textContent = total === 0
      ? 'No hay solicitudes con esos filtros.'
      : `${total} solicitud(es). Página ${pagina} de ${paginas}.`
    lista.replaceChildren(...datos.map((solicitud) => tarjetaSolicitud(solicitud, { alAprobar: cargar })))
    pie.replaceChildren(paginacion({
      pagina,
      paginas,
      alCambiar: (nueva) => {
        filtros.pagina = nueva
        cargar()
      },
    }))
  }

  const cargar = async () => {
    controlador?.abort()
    controlador = new AbortController()
    lista.setAttribute('aria-busy', 'true')

    const parametros = new URLSearchParams({ pagina: filtros.pagina, limite: TAMANO_PAGINA })
    if (filtros.estado) parametros.set('estado', filtros.estado)
    if (filtros.q) parametros.set('q', filtros.q)

    try {
      pintar(await pedir(`/api/solicitudes?${parametros}`, { senal: controlador.signal }))
    } catch (error) {
      if (esCancelada(error)) return
      avisar(error instanceof ErrorApi ? error.message : 'No se pudo cargar la lista.', 'error')
    } finally {
      lista.setAttribute('aria-busy', 'false')
    }
  }

  const buscador = crear('input', {
    type: 'search',
    name: 'q',
    placeholder: 'Buscar por nombre o correo',
    maxLength: 100,
    autocomplete: 'off',
    'aria-label': 'Buscar solicitudes',
    oninput: (evento) => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        filtros.q = evento.currentTarget.value.trim()
        filtros.pagina = 1
        cargar()
      }, ESPERA_BUSQUEDA_MS)
    },
  })

  const selectorEstado = crear('select', {
    name: 'estado',
    'aria-label': 'Filtrar por estado',
    onchange: (evento) => {
      filtros.estado = evento.currentTarget.value
      filtros.pagina = 1
      cargar()
    },
  }, [opcion('', 'Todas'), opcion('pendiente', 'Pendientes'), opcion('respondida', 'Respondidas')])

  cargar()

  return crear('section', { class: 'vista', 'aria-labelledby': 'titulo-bandeja' }, [
    crear('h2', { id: 'titulo-bandeja' }, 'Solicitudes'),
    crear('div', { class: 'filtros' }, [buscador, selectorEstado]),
    resumen,
    lista,
    pie,
  ])
}
