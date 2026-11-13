import { crear } from '../util/dom.js'
import { pedir, ErrorApi } from '../api.js'
import { avisar } from '../util/avisos.js'

const CATEGORIAS = { facturacion: 'Facturación', tecnico: 'Técnico', cuenta: 'Cuenta', otro: 'Otro' }

const formatearFecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : ''

/**
 * Tarjeta de una solicitud. Las pendientes muestran el borrador de la IA
 * en un campo editable; nada se marca como respondida sin el botón de aprobar.
 * `alAprobar` se llama cuando la aprobación fue exitosa.
 */
export const tarjetaSolicitud = (solicitud, { alAprobar }) => {
  const pendiente = solicitud.estado === 'pendiente'

  const cabecera = crear('header', { class: 'solicitud-cabecera' }, [
    crear('strong', {}, `#${solicitud.id} · ${solicitud.nombre}`),
    crear('span', { class: `etiqueta etiqueta-${solicitud.estado}` }, pendiente ? 'Pendiente' : 'Respondida'),
  ])

  const contacto = crear('p', { class: 'nota' }, `${solicitud.correo} · ${formatearFecha(solicitud.creado_en)}`)
  const mensaje = crear('p', { class: 'mensaje' }, solicitud.mensaje)

  const cuerpo = [cabecera, contacto, mensaje]

  if (pendiente) {
    const categoria = CATEGORIAS[solicitud.categoria_sugerida]
    cuerpo.push(crear('p', { class: 'nota' }, categoria
      ? `Sugerencia de la IA: ${categoria}. Revísala antes de usar el borrador.`
      : 'Sin sugerencia de la IA. Escribe tu respuesta.'))

    const respuesta = crear('textarea', {
      rows: 5,
      maxLength: 4000,
      'aria-label': `Respuesta para la solicitud ${solicitud.id}`,
    }, solicitud.borrador_sugerido ?? '')

    const aprobar = crear('button', { type: 'button', class: 'boton' }, 'Aprobar y marcar como respondida')
    aprobar.addEventListener('click', async () => {
      aprobar.disabled = true
      try {
        await pedir(`/api/solicitudes/${solicitud.id}/aprobar`, {
          metodo: 'POST',
          cuerpo: { respuesta: respuesta.value },
        })
        avisar(`Solicitud #${solicitud.id} marcada como respondida.`)
        alAprobar()
      } catch (error) {
        avisar(error instanceof ErrorApi ? error.message : 'No se pudo aprobar.', 'error')
        aprobar.disabled = false
      }
    })

    cuerpo.push(respuesta, aprobar)
  } else {
    cuerpo.push(crear('div', { class: 'respuesta-final' }, [
      crear('p', { class: 'nota' }, `Respondida el ${formatearFecha(solicitud.respondida_en)}`),
      crear('p', {}, solicitud.respuesta_final),
    ]))
  }

  return crear('li', { class: 'solicitud' }, [crear('article', { class: 'solicitud-cuerpo' }, cuerpo)])
}
