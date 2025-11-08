// api.js

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

/* =========================
 *   Dendrogramas (Req. 4)
 * ========================= */

// Endpoint que YA devuelve las 3 imágenes como dataUri + métricas
export async function fetchDendrogramas() {
    const res = await apiFetch('/api/algoritmos/dendrograma', { method: 'GET' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

// (Flujo viejo, opcional) Dispara la generación de dendrogramas (no devuelve imágenes)
export async function triggerDendrogramGeneration() {
    const res = await apiFetch('/api/algoritmos/dendrograma', { method: 'GET' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    try { return await res.json() } catch { return null }
}

// (Flujo viejo, opcional) Lista las imágenes locales más recientes por tipo a través del middleware de Vite
export async function listLocalDendrogramImages() {
    const res = await fetch('/_local/dendrogramas')
    if (!res.ok) throw new Error(`No se pudo listar imágenes locales (${res.status})`)
    return res.json()
}

/* =========================
 *   Grafos: Citaciones
 * ========================= */

/**
 * Normaliza la respuesta del back para que el front siempre reciba:
 * {
 *   graph: { nodes: [...], edges: [...] },
 *   relationships: { nodes: [...], edges: [...] },
 *   image: { filePath?: string } | null,
 *   raw: <respuesta original>
 * }
 *
 * Soporta:
 * 1) Formato nuevo (como el JSON que enviaste):
 *    { nodes:[...], edges:[...] }
 * 2) Formato anterior:
 *    { graph: {...}, relationships: {nodes:[...], edges:[...]}, image: {...} }
 */
function normalizeCitationResponse(data) {
    if (!data || typeof data !== 'object') {
        return { graph: { nodes: [], edges: [] }, relationships: { nodes: [], edges: [] }, image: null, raw: data }
    }

    // Caso 1: top-level { nodes, edges }
    if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        const rel = { nodes: data.nodes, edges: data.edges }
        return {
            graph: { nodes: rel.nodes, edges: rel.edges },
            relationships: rel,
            image: data.image ?? null,
            raw: data
        }
    }

    // Caso 2: formato anterior con relationships
    if (data.relationships && Array.isArray(data.relationships.nodes) && Array.isArray(data.relationships.edges)) {
        const rel = data.relationships
        return {
            graph: { nodes: rel.nodes, edges: rel.edges },
            relationships: rel,
            image: data.image ?? null,
            raw: data
        }
    }

    // Caso 3: formato anterior pero con graph.nodes/graph.edges
    if (data.graph && Array.isArray(data.graph.nodes) && Array.isArray(data.graph.edges)) {
        const rel = { nodes: data.graph.nodes, edges: data.graph.edges }
        return {
            graph: { nodes: rel.nodes, edges: rel.edges },
            relationships: rel,
            image: data.image ?? null,
            raw: data
        }
    }

    // Fallback seguro
    return { graph: { nodes: [], edges: [] }, relationships: { nodes: [], edges: [] }, image: data.image ?? null, raw: data }
}

/**
 * Construye el grafo de citaciones.
 * - `threshold` es opcional.
 * - `mode` (opcional) si el back lo soporta (ej: 'ABSTRACTS_TFIDF' | 'COMBINED' | 'KEYWORDS').
 * Devuelve SIEMPRE un objeto normalizado (ver normalizeCitationResponse).
 */
export async function buildCitationGraph(threshold, mode) {
    const params = new URLSearchParams()
    if (threshold != null && threshold !== '') params.set('threshold', String(threshold))
    if (mode) params.set('mode', String(mode))

    const query = params.toString()
    const url = `/api/algoritmos/citations/build${query ? `?${query}` : ''}`

    const res = await apiFetch(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)

    let data = null
    try { data = await res.json() } catch { data = null }

    return normalizeCitationResponse(data)
}

export async function shortestCitationPath(sourceId, targetId) {
    const params = new URLSearchParams()
    if (sourceId != null) params.set('sourceId', String(sourceId))
    if (targetId != null) params.set('targetId', String(targetId))
    const res = await apiFetch(`/api/algoritmos/citations/shortest?${params.toString()}`, { method: 'GET' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

export async function citationComponents() {
    const res = await apiFetch('/api/algoritmos/citations/components', { method: 'GET' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

/* =========================
 *   Grafos: Coocurrence
 * ========================= */

export async function buildCooccurrence() {
    const res = await apiFetch('/api/algoritmos/coocurrence/build', { method: 'POST' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    try { return await res.json() } catch { return null }
}

export async function buildCooccurrenceFixed() {
    const res = await apiFetch('/api/algoritmos/coocurrence/build-fixed', { method: 'POST' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    try { return await res.json() } catch { return null }
}

export async function mapFirstAuthorCountries() {
  const res = await apiFetch('/api/algoritmos/viz/map-first-author', { method: 'GET' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function wordCloud(limit) {
  const params = new URLSearchParams()
  if (limit != null && limit !== '') params.set('limit', String(limit))
  const url = `/api/algoritmos/viz/wordcloud${params.toString() ? `?${params.toString()}` : ''}`
  const res = await apiFetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchTimeline() {
  const res = await apiFetch('/api/algoritmos/viz/timeline', { method: 'GET' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  return res.json()
}

export { API_BASE }
