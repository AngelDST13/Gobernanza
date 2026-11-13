import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { abrirBase } from '../src/db.js'
import { crearServidor } from '../src/servidor.js'
import { redactar, validarSalida, sugerir } from '../src/ia.js'
import { purgarAntiguas } from '../src/solicitudes.js'

const CODIGO = 'codigo-de-prueba-largo'
const CLAVE = 'clave-muy-segura-123'

// ---------- Unidades ----------

test('redactar quita correos y teléfonos antes de enviar a un proveedor', () => {
  const texto = redactar('Escribí a ana.perez@correo.com o al 8888-7777 por la factura')
  assert.equal(texto, 'Escribí a [email] o al [telefono] por la factura')
})

test('validarSalida acepta solo categorías permitidas y borradores razonables', () => {
  assert.deepEqual(validarSalida({ categoria: 'tecnico', borrador: ' Hola ' }), { categoria: 'tecnico', borrador: 'Hola' })
  assert.equal(validarSalida({ categoria: 'reembolso_total', borrador: 'x' }), null)
  assert.equal(validarSalida({ categoria: 'otro', borrador: '' }), null)
  assert.equal(validarSalida({ categoria: 'otro', borrador: 'x'.repeat(2001) }), null)
  assert.equal(validarSalida(['otro']), null)
  assert.equal(validarSalida(null), null)
})

test('sin clave de IA se usan reglas locales y no se llama a ningún proveedor', async () => {
  let llamadas = 0
  const espia = async () => { llamadas++; throw new Error('no debería llamarse') }
  const resultado = await sugerir('No puedo entrar, la cuenta no funciona', { fetchFn: espia })
  assert.equal(llamadas, 0)
  assert.equal(resultado.proveedor, 'local')
  assert.equal(resultado.sugerencia.categoria, 'tecnico')
})

test('con clave, el texto enviado al proveedor va redactado y dentro de la etiqueta de datos', async () => {
  let cuerpoEnviado = null
  const falso = async (_url, opciones) => {
    cuerpoEnviado = JSON.parse(opciones.body)
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"categoria":"facturacion","borrador":"Revisamos tu cobro."}' }] }), { status: 200 })
  }
  const resultado = await sugerir('Me cobraron doble, soy ana@correo.com', { apiKey: 'k', modelo: 'modelo-x', fetchFn: falso })
  assert.equal(resultado.resultado, 'ok')
  assert.equal(resultado.sugerencia.categoria, 'facturacion')
  const enviado = JSON.stringify(cuerpoEnviado)
  assert.ok(!enviado.includes('ana@correo.com'), 'el correo no debe salir del servidor')
  assert.ok(enviado.includes('<solicitud>'))
})

test('si el modelo devuelve algo inválido, no hay borrador y queda registrado como invalida', async () => {
  const falso = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'Soy un texto libre' }] }), { status: 200 })
  const resultado = await sugerir('hola, necesito ayuda', { apiKey: 'k', modelo: 'm', fetchFn: falso })
  assert.equal(resultado.sugerencia, null)
  assert.equal(resultado.resultado, 'invalida')
})

test('si el proveedor falla, la solicitud se acepta igual y sin borrador', async () => {
  const falso = async () => new Response('error', { status: 500 })
  const resultado = await sugerir('hola, necesito ayuda', { apiKey: 'k', modelo: 'm', fetchFn: falso })
  assert.equal(resultado.sugerencia, null)
  assert.equal(resultado.resultado, 'error')
})

test('purgarAntiguas borra solo lo más viejo que la retención', async () => {
  const db = abrirBase(':memory:')
  const hace400 = new Date(Date.now() - 400 * 86400000).toISOString()
  const hoy = new Date().toISOString()
  db.prepare("INSERT INTO solicitudes (nombre, correo, mensaje, creado_en) VALUES ('A', 'a@x.com', 'mensaje viejo', ?)").run(hace400)
  db.prepare("INSERT INTO solicitudes (nombre, correo, mensaje, creado_en) VALUES ('B', 'b@x.com', 'mensaje nuevo', ?)").run(hoy)
  assert.equal(purgarAntiguas(db, 365), 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM solicitudes').get().n, 1)
})

// ---------- Servidor ----------

let servidor
let base
let db

before(async () => {
  db = abrirBase(':memory:')
  servidor = crearServidor(db, { codigoRegistro: CODIGO, apiKey: null, modelo: 'reglas' })
  await new Promise((resolver) => servidor.listen(0, resolver))
  base = `http://localhost:${servidor.address().port}`
})

after(() => new Promise((resolver) => servidor.close(resolver)))

const llamar = async (metodo, ruta, { cuerpo, token } = {}) => {
  const cabeceras = { 'content-type': 'application/json' }
  if (token) cabeceras.authorization = `Bearer ${token}`
  const respuesta = await fetch(base + ruta, { method: metodo, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  return { status: respuesta.status, datos: await respuesta.json().catch(() => null) }
}

test('no se puede crear cuenta sin el código de registro', async () => {
  const r = await llamar('POST', '/api/auth/registro', { cuerpo: { correo: 'a@b.com', nombre: 'Ana', clave: CLAVE, codigo: 'malo' } })
  assert.equal(r.status, 403)
})

test('registro, inicio de sesión y clave incorrecta', async () => {
  const alta = await llamar('POST', '/api/auth/registro', { cuerpo: { correo: 'Agente@Ejemplo.com', nombre: 'Ana Agente', clave: CLAVE, codigo: CODIGO } })
  assert.equal(alta.status, 201)
  assert.equal(alta.datos.correo, 'agente@ejemplo.com')
  assert.ok(!JSON.stringify(alta.datos).includes('hash'), 'la respuesta no debe mostrar el hash')

  const malo = await llamar('POST', '/api/auth/login', { cuerpo: { correo: 'agente@ejemplo.com', clave: 'otra-clave-larga' } })
  assert.equal(malo.status, 401)

  const bueno = await llamar('POST', '/api/auth/login', { cuerpo: { correo: 'agente@ejemplo.com', clave: CLAVE } })
  assert.equal(bueno.status, 200)
  assert.ok(bueno.datos.token)
  tokenAgente = bueno.datos.token
})

let tokenAgente

test('la clave se guarda con hash, nunca en texto plano', () => {
  const fila = db.prepare('SELECT hash_clave FROM usuarios').get()
  assert.ok(fila.hash_clave.startsWith('scrypt$'))
  assert.ok(!fila.hash_clave.includes(CLAVE))
})

test('la bandeja exige sesión', async () => {
  const r = await llamar('GET', '/api/solicitudes')
  assert.equal(r.status, 401)
})

let idSolicitud
test('cualquier cliente puede enviar una solicitud y queda pendiente con sugerencia', async () => {
  const r = await llamar('POST', '/api/solicitudes', { cuerpo: { nombre: 'Luis', correo: 'luis@cliente.com', mensaje: 'Me cobraron dos veces la factura de mayo', consentimiento: 'on' } })
  assert.equal(r.status, 201)
  assert.equal(r.datos.estado, 'pendiente')
  idSolicitud = r.datos.id

  const lista = await llamar('GET', '/api/solicitudes', { token: tokenAgente })
  const fila = lista.datos.datos.find((s) => s.id === idSolicitud)
  assert.equal(fila.estado, 'pendiente')
  assert.equal(fila.categoria_sugerida, 'facturacion')
})

test('sin consentimiento informado el mensaje no se guarda, aunque los demás datos sean válidos', async () => {
  const sinCasilla = await llamar('POST', '/api/solicitudes', { cuerpo: { nombre: 'Ana', correo: 'ana@ejemplo.com', mensaje: 'Consulta sobre la factura' } })
  assert.equal(sinCasilla.status, 400)
  const casillaFalsa = await llamar('POST', '/api/solicitudes', { cuerpo: { nombre: 'Ana', correo: 'ana@ejemplo.com', mensaje: 'Consulta sobre la factura', consentimiento: 'no' } })
  assert.equal(casillaFalsa.status, 400)
})

test('una solicitud con datos inválidos se rechaza', async () => {
  const r = await llamar('POST', '/api/solicitudes', { cuerpo: { nombre: 'X', correo: 'no-es-correo', mensaje: 'hola' } })
  assert.equal(r.status, 400)
})

test('la IA no puede dejar una solicitud respondida: la aprobación exige texto de una persona', async () => {
  const sinTexto = await llamar('POST', `/api/solicitudes/${idSolicitud}/aprobar`, { token: tokenAgente, cuerpo: {} })
  assert.equal(sinTexto.status, 400)

  const sinSesion = await llamar('POST', `/api/solicitudes/${idSolicitud}/aprobar`, { cuerpo: { respuesta: 'Gracias, lo revisamos.' } })
  assert.equal(sinSesion.status, 401)
})

test('un agente aprueba la respuesta y queda registrado quién la aprobó', async () => {
  const r = await llamar('POST', `/api/solicitudes/${idSolicitud}/aprobar`, { token: tokenAgente, cuerpo: { respuesta: 'Revisamos el cobro y te devolvemos el excedente.' } })
  assert.equal(r.status, 200)
  assert.equal(r.datos.estado, 'respondida')
  const fila = db.prepare('SELECT estado, aprobado_por FROM solicitudes WHERE id = ?').get(idSolicitud)
  assert.equal(fila.estado, 'respondida')
  assert.ok(fila.aprobado_por > 0)
})

test('derecho de acceso: exportar lo que se guarda de un correo', async () => {
  const r = await llamar('GET', '/api/personas/luis%40cliente.com/exportar', { token: tokenAgente })
  assert.equal(r.status, 200)
  assert.equal(r.datos.length, 1)
  assert.equal(r.datos[0].correo, 'luis@cliente.com')
})

test('derecho de supresión: borrar una solicitud', async () => {
  const r = await llamar('DELETE', `/api/solicitudes/${idSolicitud}`, { token: tokenAgente })
  assert.equal(r.status, 200)
  const otra = await llamar('DELETE', `/api/solicitudes/${idSolicitud}`, { token: tokenAgente })
  assert.equal(otra.status, 404)
})

test('cerrar sesión invalida el token', async () => {
  await llamar('POST', '/api/auth/salir', { token: tokenAgente })
  const r = await llamar('GET', '/api/solicitudes', { token: tokenAgente })
  assert.equal(r.status, 401)
})

test('rutas desconocidas y archivos fuera de public/ no se sirven', async () => {
  assert.equal((await llamar('GET', '/api/no-existe')).status, 404)
  const archivo = await fetch(`${base}/src/auth.js`)
  assert.equal(archivo.status, 404)
})

test('se sirven archivos de subcarpetas de public/ y no se escapa de public/', async () => {
  const js = await fetch(`${base}/js/main.js`)
  assert.equal(js.status, 200)
  assert.match(js.headers.get('content-type'), /javascript/)

  for (const ruta of ['/js/../../package.json', '/%2e%2e/package.json', '/js/%2e%2e/%2e%2e/package.json', '/%E0%A4%A']) {
    const r = await fetch(base + ruta)
    assert.equal(r.status, 404, `no debe servir ${ruta}`)
  }
})

// ---------- Lista paginada, filtro y búsqueda ----------

test('la lista está paginada y acepta filtros, con límite máximo', async () => {
  const sesion = await llamar('POST', '/api/auth/login', { cuerpo: { correo: 'agente@ejemplo.com', clave: CLAVE } })
  const token = sesion.datos.token

  // Datos inventados: 25 solicitudes.
  for (let i = 1; i <= 25; i++) {
    await llamar('POST', '/api/solicitudes', { cuerpo: { nombre: `Cliente ${i}`, correo: `cliente${i}@ejemplo.com`, mensaje: `consulta número ${i} sobre el servicio`, consentimiento: 'on' } })
  }
  const pag1 = await llamar('GET', '/api/solicitudes?limite=10', { token })
  assert.equal(pag1.status, 200)
  assert.equal(pag1.datos.datos.length, 10)
  assert.equal(pag1.datos.total, 25)
  assert.equal(pag1.datos.paginas, 3)

  const pag3 = await llamar('GET', '/api/solicitudes?limite=10&pagina=3', { token })
  assert.equal(pag3.datos.datos.length, 5)

  const grande = await llamar('GET', '/api/solicitudes?limite=500', { token })
  assert.equal(grande.status, 400)

  const pendientes = await llamar('GET', '/api/solicitudes?estado=pendiente&limite=50', { token })
  assert.ok(pendientes.datos.datos.every((s) => s.estado === 'pendiente'))

  const malo = await llamar('GET', '/api/solicitudes?estado=borrada', { token })
  assert.equal(malo.status, 400)
})

test('la búsqueda es literal: los comodines de LIKE no cambian el resultado', async () => {
  const sesion = await llamar('POST', '/api/auth/login', { cuerpo: { correo: 'agente@ejemplo.com', clave: CLAVE } })
  const token = sesion.datos.token

  const porcentaje = await llamar('GET', '/api/solicitudes?q=%25&limite=50', { token })
  assert.equal(porcentaje.datos.total, 0, 'el signo % no debe comportarse como comodín')

  const cliente = await llamar('GET', '/api/solicitudes?q=cliente7%40&limite=50', { token })
  assert.equal(cliente.datos.total, 1)
})
