import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Abre (o crea) la base SQLite y asegura el esquema.
 * `ruta` puede ser ':memory:' para pruebas.
 */
export const abrirBase = (ruta = ':memory:') => {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true })
  const db = new DatabaseSync(ruta)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      correo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      hash_clave TEXT NOT NULL,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      token_hash TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      categoria_sugerida TEXT,
      borrador_sugerido TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'respondida')),
      respuesta_final TEXT,
      aprobado_por INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL,
      respondida_en TEXT
    );

    CREATE TABLE IF NOT EXISTS registros_ia (
      id INTEGER PRIMARY KEY,
      solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE SET NULL,
      proveedor TEXT NOT NULL,
      modelo TEXT NOT NULL,
      duracion_ms INTEGER NOT NULL,
      resultado TEXT NOT NULL CHECK (resultado IN ('ok', 'invalida', 'error')),
      creado_en TEXT NOT NULL
    );
  `)
  return db
}
