/**
 * Crea elementos del DOM de forma segura.
 * El texto siempre entra con textContent: nada que venga de un cliente se interpreta como HTML.
 *
 *   crear('p', { class: 'nota' }, ['Hola ', crear('strong', {}, 'Ana')])
 */
export const crear = (etiqueta, propiedades = {}, hijos = []) => {
  const elemento = document.createElement(etiqueta)

  for (const [clave, valor] of Object.entries(propiedades)) {
    if (valor === undefined || valor === null || valor === false) continue
    if (clave === 'class') {
      elemento.className = valor
    } else if (clave.startsWith('on') && typeof valor === 'function') {
      elemento.addEventListener(clave.slice(2), valor)
    } else if (clave in elemento) {
      elemento[clave] = valor
    } else {
      elemento.setAttribute(clave, valor === true ? '' : String(valor))
    }
  }

  const lista = [hijos].flat().filter((hijo) => hijo !== null && hijo !== undefined && hijo !== false)
  elemento.append(...lista.map((hijo) => (hijo instanceof Node ? hijo : document.createTextNode(String(hijo)))))
  return elemento
}

/** Campo de formulario con su etiqueta visible. La etiqueta envuelve al control: accesible por defecto. */
export const campo = (texto, control) => crear('label', { class: 'campo' }, [crear('span', {}, texto), control])
