import { crear, campo } from '../util/dom.js'
import { pedir, ErrorApi } from '../api.js'
import { avisar } from '../util/avisos.js'

/** Formulario público: cualquier cliente puede enviar una solicitud. */
export const vistaPublica = () => {
  const enviar = async (evento) => {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const boton = formulario.querySelector('button[type="submit"]')
    boton.disabled = true
    boton.textContent = 'Enviando…'

    try {
      await pedir('/api/solicitudes', { metodo: 'POST', cuerpo: Object.fromEntries(new FormData(formulario)) })
      formulario.reset()
      avisar('Recibimos tu mensaje. Te responderemos pronto.')
    } catch (error) {
      avisar(error instanceof ErrorApi ? error.message : 'No se pudo enviar. Intenta de nuevo.', 'error')
    } finally {
      boton.disabled = false
      boton.textContent = 'Enviar'
    }
  }

  return crear('section', { class: 'vista', 'aria-labelledby': 'titulo-publico' }, [
    crear('h2', { id: 'titulo-publico' }, 'Escríbenos'),
    crear('form', { class: 'formulario', onsubmit: enviar, novalidate: false }, [
      campo('Nombre', crear('input', { name: 'nombre', required: true, minLength: 2, maxLength: 100, autocomplete: 'name' })),
      campo('Correo', crear('input', { name: 'correo', type: 'email', required: true, autocomplete: 'email' })),
      campo('Mensaje', crear('textarea', { name: 'mensaje', required: true, minLength: 5, maxLength: 2000, rows: 5 })),
      crear('label', { class: 'consentimiento' }, [
        crear('input', { type: 'checkbox', name: 'consentimiento', required: true }),
        crear('span', {}, 'Acepto que guardemos mi nombre, correo y mensaje para responderme. Puedo pedir copia o borrado escribiendo a soporte.'),
      ]),
      crear('button', { type: 'submit', class: 'boton' }, 'Enviar'),
    ]),
  ])
}
