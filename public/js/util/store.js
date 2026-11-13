/**
 * Store mínimo: un único objeto de estado, cambios por fusión y suscriptores.
 * Las vistas leen con obtener() y reaccionan con suscribir(); nunca guardan
 * copias propias de la sesión.
 */
export const crearStore = (estadoInicial) => {
  let estado = estadoInicial
  const suscriptores = new Set()

  return {
    obtener: () => estado,
    actualizar(cambios) {
      estado = { ...estado, ...cambios }
      suscriptores.forEach((alCambiar) => alCambiar(estado))
    },
    suscribir(alCambiar) {
      suscriptores.add(alCambiar)
      return () => suscriptores.delete(alCambiar)
    },
  }
}
