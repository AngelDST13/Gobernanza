import { crear } from '../util/dom.js'

/** Controles de página anterior y siguiente. `alCambiar(nuevaPagina)` se llama al pulsar. */
export const paginacion = ({ pagina, paginas, alCambiar }) => {
  if (paginas <= 1) return crear('span')

  return crear('nav', { 'aria-label': 'Paginación' }, [
    crear('button', {
      type: 'button',
      class: 'boton boton-secundario',
      disabled: pagina <= 1,
      onclick: () => alCambiar(pagina - 1),
    }, 'Anterior'),
    crear('span', { class: 'nota' }, `Página ${pagina} de ${paginas}`),
    crear('button', {
      type: 'button',
      class: 'boton boton-secundario',
      disabled: pagina >= paginas,
      onclick: () => alCambiar(pagina + 1),
    }, 'Siguiente'),
  ])
}
