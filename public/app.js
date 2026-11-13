const claveToken = 'gobernanza.token'

// Lee el token de forma segura: el navegador puede bloquear localStorage.
const leerToken = () => {
  try { return sessionStorage.getItem(claveToken) } catch { return null }
}
const guardarToken = (token) => {
  try { sessionStorage.setItem(claveToken, token) } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
}
const borrarToken = () => {
  try { sessionStorage.removeItem(claveToken) } catch { /* nada que borrar */ }
}

let token = leerToken()

const pedir = async (ruta, { metodo = 'GET', cuerpo } = {}) => {
  const cabeceras = { 'content-type': 'application/json' }
  if (token) cabeceras.authorization = `Bearer ${token}`
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.error ?? 'error')
  return datos
}

const formularioSolicitud = document.getElementById('formulario-solicitud')
formularioSolicitud.addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const estado = document.getElementById('estado-solicitud')
  const datos = Object.fromEntries(new FormData(formularioSolicitud))
  try {
    await pedir('/api/solicitudes', { metodo: 'POST', cuerpo: datos })
    formularioSolicitud.reset()
    estado.textContent = 'Recibimos tu mensaje. Te responderemos pronto.'
  } catch (error) {
    estado.textContent = `No se pudo enviar: ${error.message}`
  }
})

const formularioLogin = document.getElementById('formulario-login')
formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const estado = document.getElementById('estado-login')
  try {
    const sesion = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: Object.fromEntries(new FormData(formularioLogin)) })
    token = sesion.token
    guardarToken(token)
    mostrarPanel()
  } catch (error) {
    estado.textContent = error.message
  }
})

const mostrarPanel = async () => {
  document.getElementById('acceso').hidden = true
  document.getElementById('agentes').hidden = false
  await cargarLista()
}

const crearFila = (solicitud) => {
  const item = document.createElement('li')
  item.className = `solicitud ${solicitud.estado}`

  const encabezado = document.createElement('p')
  encabezado.textContent = `#${solicitud.id} · ${solicitud.nombre} · ${solicitud.correo} · ${solicitud.estado}`

  const mensaje = document.createElement('p')
  mensaje.textContent = solicitud.mensaje

  item.append(encabezado, mensaje)

  if (solicitud.estado === 'pendiente') {
    const sugerencia = document.createElement('p')
    sugerencia.className = 'nota'
    sugerencia.textContent = solicitud.categoria_sugerida
      ? `Sugerencia de la IA (${solicitud.categoria_sugerida}). Revísala antes de usarla.`
      : 'Sin sugerencia de la IA. Responde tú.'

    const area = document.createElement('textarea')
    area.rows = 4
    area.maxLength = 4000
    area.value = solicitud.borrador_sugerido ?? ''

    const boton = document.createElement('button')
    boton.type = 'button'
    boton.textContent = 'Aprobar y marcar como respondida'
    boton.addEventListener('click', async () => {
      try {
        await pedir(`/api/solicitudes/${solicitud.id}/aprobar`, { metodo: 'POST', cuerpo: { respuesta: area.value } })
        await cargarLista()
      } catch (error) {
        encabezado.textContent = `No se pudo aprobar: ${error.message}`
      }
    })

    item.append(sugerencia, area, boton)
  } else {
    const respuesta = document.createElement('p')
    respuesta.textContent = `Respuesta aprobada: ${solicitud.respuesta_final}`
    item.append(respuesta)
  }
  return item
}

const cargarLista = async () => {
  const lista = document.getElementById('lista')
  lista.replaceChildren()
  try {
    const solicitudes = await pedir('/api/solicitudes')
    if (solicitudes.length === 0) {
      const vacio = document.createElement('li')
      vacio.textContent = 'No hay solicitudes.'
      lista.append(vacio)
    }
    solicitudes.forEach((solicitud) => lista.append(crearFila(solicitud)))
  } catch {
    borrarToken()
    token = null
    document.getElementById('agentes').hidden = true
    document.getElementById('acceso').hidden = false
  }
}

document.getElementById('salir').addEventListener('click', async () => {
  await pedir('/api/auth/salir', { metodo: 'POST' }).catch(() => {})
  borrarToken()
  token = null
  document.getElementById('agentes').hidden = true
  document.getElementById('acceso').hidden = false
})

if (token) mostrarPanel()
