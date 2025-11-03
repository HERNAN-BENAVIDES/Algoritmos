// Centraliza la URL base de la API usando variables de entorno de Vite
// Usa VITE_API_URL si está definida, con fallback a http://localhost:8080
const RAW_API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8080'

// Normaliza: quita barras finales repetidas
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, '')

// Une la base con un path asegurando una sola barra
export function apiUrl(path) {
  if (!path) return API_BASE
  const cleanPath = String(path).startsWith('/') ? path : `/${path}`
  return `${API_BASE}${cleanPath}`
}

// Wrapper de fetch que antepone la base automáticamente
export function apiFetch(path, options) {
  return fetch(apiUrl(path), options)
}

// Dispara la generación de dendrogramas (no devuelve imágenes)
export async function triggerDendrogramGeneration() {
  const res = await apiFetch('/api/algoritmos/dendrograma', { method: 'GET' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  // La API puede devolver un JSON de confirmación; lo ignoramos para frontend
  try { return await res.json() } catch { return null }
}

// Lista las imágenes locales más recientes por tipo a través del middleware de Vite
export async function listLocalDendrogramImages() {
  const res = await fetch('/_local/dendrogramas')
  if (!res.ok) throw new Error(`No se pudo listar imágenes locales (${res.status})`)
  return res.json()
}

export { API_BASE }
