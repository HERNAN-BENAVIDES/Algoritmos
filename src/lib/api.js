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

export { API_BASE }
