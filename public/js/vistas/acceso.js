import { crear, campo } from '../util/dom.js'
import { pedir, ErrorApi } from '../api.js'

/**
 * Inicio de sesión de agentes.
 * `alIniciar(sesion)` recibe { token, usuario } y decide qué hacer después.
 */
export const vistaAcceso = ({ alIniciar }) => {
  const estado = crear('p', { class: 'nota', role: 'status' })

  const entrar = async (evento) => {
    evento.preventDefault()
    estado.textContent = 'Entrando…'
    try {
      const sesion = await pedir('/api/auth/login', {
        metodo: 'POST',
        cuerpo: Object.fromEntries(new FormData(evento.currentTarget)),
      })
      alIniciar(sesion)
    } catch (error) {
      estado.textContent = error instanceof ErrorApi ? error.message : 'No se pudo iniciar sesión.'
    }
  }

  return crear('section', { class: 'vista', 'aria-labelledby': 'titulo-acceso' }, [
    crear('h2', { id: 'titulo-acceso' }, 'Acceso de agentes'),
    crear('form', { class: 'formulario', onsubmit: entrar }, [
      campo('Correo', crear('input', { name: 'correo', type: 'email', required: true, autocomplete: 'username' })),
      campo('Clave', crear('input', { name: 'clave', type: 'password', required: true, minLength: 10, autocomplete: 'current-password' })),
      crear('button', { type: 'submit', class: 'boton' }, 'Entrar'),
      estado,
    ]),
  ])
}
