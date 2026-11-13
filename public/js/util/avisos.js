import { crear } from './dom.js'

// Región accesible: los lectores de pantalla anuncian los mensajes que aparecen aquí.
const region = () => document.getElementById('avisos')

/** Muestra un aviso breve. tipo: 'ok' o 'error'. Desaparece solo. */
export const avisar = (texto, tipo = 'ok') => {
  const aviso = crear('p', { class: `aviso aviso-${tipo}` }, texto)
  region().append(aviso)
  setTimeout(() => aviso.remove(), 5000)
}
