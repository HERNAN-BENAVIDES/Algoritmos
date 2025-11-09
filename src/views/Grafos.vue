<template>
  <div class="graphs-view">
    <div class="header-row">
      <h2>Grafo de citaciones</h2>
    </div>

    <!-- Construcción del grafo -->
    <section class="card">
      <h3>Construcción</h3>
      <form class="row" @submit.prevent="onBuildCitation">
        <label class="field">
          Umbral (threshold, opcional)
          <input v-model.number="threshold" type="number" step="0.01" min="0" placeholder="p. ej. 0.15" />
        </label>
        <button class="primary" type="submit" :disabled="loading.buildCitation">
          {{ loading.buildCitation ? 'Construyendo…' : 'Construir grafo' }}
        </button>
      </form>

      <div v-if="citationResult" class="result">
        <div class="row wrap">
          <div><strong>Nodos:</strong> {{ citationResult.relationships?.nodes?.length ?? '—' }}</div>
          <div><strong>Aristas:</strong> {{ citationResult.relationships?.edges?.length ?? '—' }}</div>
        </div>

        <details>
          <summary>Relationships (JSON)</summary>
          <pre>{{ pretty(citationResult.relationships) }}</pre>
        </details>
      </div>

      <!-- Contenedor del grafo -->
      <div class="graph-wrapper">
        <div ref="cyContainer" class="cy"></div>

        <!-- Panel de detalles -->
        <div v-if="detail.visible" class="detail-panel" @click.stop>
          <header class="detail-header">
            <strong>{{ detail.type === 'node' ? 'Nodo' : 'Arista' }}</strong>
            <button class="icon-btn" @click="detail.visible = false" title="Cerrar">✕</button>
          </header>

          <div v-if="detail.type === 'node'" class="detail-body">
            <div class="kv">
              <span class="k">DOI/ID</span>
              <span class="v mono">{{ detail.node?.id }}</span>
            </div>
            <div class="kv">
              <span class="k">Título</span>
              <span class="v">{{ detail.node?.title || '—' }}</span>
            </div>
            <div class="kv">
              <span class="k">Año</span>
              <span class="v">{{ detail.node?.year ?? '—' }}</span>
            </div>
            <button class="secondary wfull" @click.stop="copyDoi(detail.node?.id)">
              Copiar DOI/ID
            </button>
            <p v-if="copied" class="copy-ok">Copiado ✔</p>
          </div>

          <div v-else class="detail-body">
            <div class="kv">
              <span class="k">Origen</span>
              <span class="v mono">{{ detail.edge?.from }}</span>
            </div>
            <div class="kv">
              <span class="k">Destino</span>
              <span class="v mono">{{ detail.edge?.to }}</span>
            </div>
            <div class="kv">
              <span class="k">Peso</span>
              <span class="v">{{ nf(detail.edge?.weight) }}</span>
            </div>
            <div class="kv">
              <span class="k">Similitud</span>
              <span class="v">{{ nf(detail.edge?.similarity) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Camino mínimo -->
    <section class="card">
      <h3>Camino mínimo entre artículos</h3>
      <form class="row" @submit.prevent="onShortestPath">
        <label class="field">
          Source ID
          <input v-model="sourceId" placeholder="id artículo origen" />
        </label>
        <label class="field">
          Target ID
          <input v-model="targetId" placeholder="id artículo destino" />
        </label>
        <button class="primary" type="submit" :disabled="loading.shortest">
          {{ loading.shortest ? 'Consultando…' : 'Calcular camino' }}
        </button>
        <button class="secondary" type="button" @click="clearPath" :disabled="!cy">
          Limpiar camino
        </button>
      </form>
      <div v-if="shortestResult" class="result">
        <div><strong>Distancia:</strong> {{ shortestResult.distance }}</div>
        <div><strong>Camino:</strong> {{ Array.isArray(shortestResult.path) ? shortestResult.path.join(' → ') : '—' }}</div>
      </div>
    </section>

    <!-- Componentes -->
    <section class="card">
      <h3>Componentes (visualización)</h3>

      <div class="row wrap">
        <label class="field">
          <select v-model="compType">
            <option value="weak">Débiles (Weakly Connected)</option>
            <option value="strong">Fuertes (Strongly Connected)</option>
          </select>
        </label>

        <button class="secondary" @click="loadAndShowComponents" :disabled="loading.components || !cy">
          {{ loading.components ? 'Consultando…' : 'Mostrar componentes' }}
        </button>

        <button class="secondary" @click="clearComponentsAction" :disabled="!cy">
          Limpiar
        </button>
      </div>

      <div v-if="compList.length" class="comp-list">
        <div
            class="comp-item"
            v-for="(ids, idx) in compList"
            :key="idx"
            @click="focusComponent(idx)"
            :style="{ '--comp-color': compColor(idx, ids.length) }"
        >
          <span class="dot"></span>
          <strong>Comp {{ idx + 1 }}</strong>
          <span class="muted">({{ ids.length }} nodo{{ ids.length===1?'':'s' }})</span>
          <span class="muted" v-if="ids.length===1"> • solitario</span>
        </div>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import cytoscape from 'cytoscape'
import { buildCitationGraph, shortestCitationPath, citationComponents } from '@/lib/api'

/* ----------------- estado UI ----------------- */
const threshold = ref()
const sourceId = ref('')
const targetId = ref('')

const loading = ref({
  buildCitation: false,
  shortest: false,
  components: false
})

const error = ref('')
const copied = ref(false)

/* ----------------- datos backend ----------------- */
const citationResult = ref(null)
const shortestResult = ref(null)
const componentsResult = ref(null)

/* ----------------- cytoscape ----------------- */
const cyContainer = ref(null)
let cy = null

/* Panel detalle */
const detail = ref({
  visible: false,
  type: 'node', // 'node' | 'edge'
  node: null,   // { id, title, year }
  edge: null    // { from, to, weight, similarity }
})

/* ----------------- helpers ----------------- */
function pretty(obj) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}
function nf(v) {
  return (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(3)
}

async function safeRun(key, fn) {
  error.value = ''
  loading.value[key] = true
  try {
    return await fn()
  } catch (e) {
    error.value = e?.message || 'Error inesperado'
    return null
  } finally {
    loading.value[key] = false
  }
}

/* ----------------- construir grafo ----------------- */
async function onBuildCitation() {
  const res = await safeRun('buildCitation', () => buildCitationGraph(threshold.value))
  if (!res) return
  citationResult.value = {
    graph: { nodes: res.graph?.nodes ?? 0, edges: res.graph?.edges ?? 0 },
    relationships: res.relationships
  }
  renderGraph(res.relationships)
}

function renderGraph(relationships) {
  if (cy) { cy.destroy(); cy = null }

  const nodes = relationships?.nodes ?? []
  const edges = relationships?.edges ?? []

  cy = cytoscape({
    container: cyContainer.value,
    elements: [
      ...nodes.map(n => ({
        data: { id: n.id, title: n.title, year: n.year }
      })),
      ...edges.map(e => ({
        data: {
          id: `${e.from}__${e.to}`,
          source: e.from,
          target: e.to,
          weight: e.weight,
          similarity: e.similarity
        }
      }))
    ],
    style: [
      // Estilo base (no usa rojo)
      {
        selector: 'node',
        style: {
          'shape': 'ellipse',
          'background-color': '#2b8a3e',
          'border-color': '#1b4332',
          'border-width': 1,
          'width': (ele) => {
            const deg = ele.degree(false)
            return Math.max(10, Math.min(28, 10 + Math.log2(deg + 2) * 6))
          },
          'height': (ele) => {
            const deg = ele.degree(false)
            return Math.max(10, Math.min(28, 10 + Math.log2(deg + 2) * 6))
          },
          'label': '',
          'text-opacity': 0
        }
      },
      {
        selector: 'edge',
        style: {
          'line-color': '#3c78c8',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#3c78c8',
          'curve-style': 'bezier',
          'width': (ele) => {
            const s = Number(ele.data('similarity') ?? 0)
            return 1 + 3 * Math.max(0, Math.min(1, s))
          },
          'opacity': (ele) => {
            const s = Number(ele.data('similarity') ?? 0)
            return 0.25 + 0.6 * Math.max(0, Math.min(1, s))
          }
        }
      },
      // ❗️Rojo reservado para caminos (no se usa en ningún otro lugar)
      {
        selector: '.path-node',
        style: {
          'background-color': '#dc2626',
          'border-color': '#7f1d1d',
          'border-width': 2
        }
      },
      {
        selector: '.path-edge',
        style: {
          'line-color': '#dc2626',
          'target-arrow-color': '#dc2626',
          'width': 4,
          'opacity': 0.95
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 30,
      nodeRepulsion: 2048,
      idealEdgeLength: 64,
      gravity: 0.2
    },
    wheelSensitivity: 0.2
  })

  cy.once('layoutstop', () => fitView())

  cy.on('tap', 'node', (evt) => {
    // No limpiar camino al inspeccionar, solo ocultamos panel si hace falta
    const n = evt.target
    detail.value = {
      visible: true,
      type: 'node',
      node: { id: n.id(), title: n.data('title'), year: n.data('year') },
      edge: null
    }
  })

  cy.on('tap', 'edge', (evt) => {
    const e = evt.target
    detail.value = {
      visible: true,
      type: 'edge',
      node: null,
      edge: {
        from: e.data('source'),
        to: e.data('target'),
        weight: e.data('weight'),
        similarity: e.data('similarity')
      }
    }
  })

  cy.on('tap', (evt) => {
    if (evt.target === cy) detail.value = { visible: false, type: 'node', node: null, edge: null }
  })

  fitView()
}

function fitView() { if (cy) cy.fit(cy.elements(), 40) }

/* ----------------- copiar DOI/ID ----------------- */
async function copyDoi(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(String(text))
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = String(text)
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } finally { document.body.removeChild(ta) }
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  }
}

/* ----------------- camino mínimo (resalta en ROJO) ----------------- */
async function onShortestPath() {
  const s = (sourceId.value || '').trim()
  const t = (targetId.value || '').trim()
  if (!s || !t) { error.value = 'Debes ingresar sourceId y targetId'; return }
  const res = await safeRun('shortest', () => shortestCitationPath(s, t))
  if (!res) return
  shortestResult.value = res
  highlightPath(res.path || [])
}

function clearPath() { shortestResult.value = null; clearPathClasses() }

function clearPathClasses() {
  if (!cy) return
  cy.nodes().removeClass('path-node')
  cy.edges().removeClass('path-edge')
}

function edgesBetween(u, v) {
  const all = cy ? cy.edges() : null
  if (!all) return cy.collection()
  return all.filter(e => {
    const s = e.data('source')
    const t = e.data('target')
    return (s === u && t === v) || (s === v && t === u)
  })
}

function elementExists(coll) { return coll && coll.length && !coll.empty() }

function highlightPath(pathIds) {
  if (!cy || !Array.isArray(pathIds) || pathIds.length < 2) return
  clearPathClasses()

  cy.batch(() => {
    // Nodos del camino (eliminamos cualquier bypass para que prevalezca la clase roja)
    pathIds.forEach(id => {
      const n = cy.getElementById(String(id))
      if (elementExists(n)) {
        n.removeStyle()           // quita estilos inline previos (componentes, focus, etc.)
        n.addClass('path-node')   // aplica estilo ROJO reservado
      }
    })
    // Aristas entre nodos consecutivos
    for (let i = 0; i < pathIds.length - 1; i++) {
      const u = String(pathIds[i])
      const v = String(pathIds[i + 1])
      const es = edgesBetween(u, v)
      if (elementExists(es)) {
        es.removeStyle()          // quita bypass para que prevalezca clase
        es.addClass('path-edge')  // estilo ROJO reservado
      }
    }
  })

  const nodesSel = cy.$('.path-node')
  const edgesSel = cy.$('.path-edge')
  const eles = nodesSel.union(edgesSel)
  if (elementExists(eles)) {
    cy.animate({ fit: { eles, padding: 60 }, duration: 450, easing: 'ease' })
  } else if (elementExists(nodesSel)) {
    cy.animate({ fit: { eles: nodesSel, padding: 60 }, duration: 450, easing: 'ease' })
  }
}

/* ----------------- componentes ----------------- */
const compType = ref('weak')
const compList = ref([])
const singletonGray = '#9ca3af'

// Paleta de componentes SIN rojos (rojo reservado para caminos)
const compPalette = [
  '#2563eb', // azul
  '#16a34a', // verde
  '#7c3aed', // púrpura
  '#0891b2', // cian
  '#ca8a04', // ámbar oscuro
  '#9333ea', // violeta
  '#059669', // verde
  '#0ea5e9', // azul claro
  '#d946ef', // fucsia
  '#f59e0b', // ámbar
  '#06b6d4', // cian
  '#84cc16'  // lima
]
function compColor(idx, size) {
  return size === 1 ? singletonGray : compPalette[idx % compPalette.length]
}

async function loadAndShowComponents() {
  const res = await safeRun('components', citationComponents)
  if (!res) return
  componentsResult.value = res
  const list = Array.isArray(res?.[compType.value]) ? res[compType.value] : []
  compList.value = list
  if (!cy) { error.value = 'Primero construye el grafo.'; return }
  applyComponentsToGraph(list)
}

function applyComponentsToGraph(components) {
  clearComponentsView()

  // pertenencia (nodo -> índice componente) y tamaños
  const belong = new Map()
  const compSizes = new Map()
  components.forEach((arr, idx) => {
    compSizes.set(idx, (arr || []).length)
    ;(arr || []).forEach(id => belong.set(id, idx))
  })

  // NODOS: no tocar los que estén en el camino (clase .path-node)
  cy.nodes().forEach(n => {
    if (n.hasClass('path-node')) return
    const id = n.id()
    if (belong.has(id)) {
      const idx = belong.get(id)
      const size = compSizes.get(idx) || 0
      const color = compColor(idx, size)
      n.style({
        'background-color': color,
        'border-color': size === 1 ? '#6b7280' : '#111827',
        'border-width': size === 1 ? 1 : 2,
        'opacity': 1
      })
    } else {
      n.style({ 'opacity': 0.15 })
    }
  })

  // ARISTAS: no tocar las del camino (clase .path-edge)
  cy.edges().forEach(e => {
    if (e.hasClass('path-edge')) return
    const s = e.source().id()
    const t = e.target().id()
    const is = belong.get(s)
    const it = belong.get(t)
    const sameComp = (is != null && it != null && is === it)
    const compSize = sameComp ? (compSizes.get(is) || 0) : 0
    e.style({ 'opacity': sameComp && compSize > 1 ? 0.9 : 0.12 })
  })

  fitView()
}

function focusComponent(idx) {
  if (!cy || !Array.isArray(compList.value[idx])) return
  const ids = compList.value[idx]
  const size = ids.length
  const baseColor = compColor(idx, size)

  cy.nodes().forEach(n => {
    // no sobrescribir nodos del camino
    if (n.hasClass('path-node')) return
    if (ids.includes(n.id())) {
      n.style({
        'opacity': 1,
        'background-color': baseColor,
        'border-color': size === 1 ? '#6b7280' : '#111827',
        'border-width': size === 1 ? 1 : 2
      })
    } else {
      n.style({ 'opacity': 0.12 })
    }
  })

  cy.edges().forEach(e => {
    // no sobrescribir aristas del camino
    if (e.hasClass('path-edge')) return
    const inComp = ids.includes(e.source().id()) && ids.includes(e.target().id())
    e.style({ 'opacity': inComp && size > 1 ? 0.9 : 0.08 })
  })

  if (ids.length) {
    const nodes = cy.collection(ids.map(id => cy.getElementById(id)).filter(x => x && x.nonempty()))
    const edges = cy.edges().filter(e => ids.includes(e.source().id()) && ids.includes(e.target().id()))
    const sel = nodes.union(edges)
    cy.animate({ fit: { eles: sel, padding: 80 }, duration: 500, easing: 'ease' })
  }
}

// Restablece estilos base, pero RESPETA el rojo del camino
function clearComponentsView() {
  if (!cy) return
  // Nodos: reset para todos EXCEPTO los del camino
  cy.nodes().not('.path-node').forEach(n => {
    n.style({
      'background-color': '#2b8a3e',
      'border-color': '#1b4332',
      'border-width': 1,
      'opacity': 1
    })
  })
  // Aristas: reset para todas EXCEPTO las del camino
  cy.edges().not('.path-edge').forEach(e => {
    const s = Number(e.data('similarity') ?? 0)
    e.style({
      'line-color': '#3c78c8',
      'target-arrow-color': '#3c78c8',
      'opacity': 0.25 + 0.6 * Math.max(0, Math.min(1, s))
    })
  })
}

function clearComponentsAction(){
  clearComponentsView()
  compList.value = []
  componentsResult.value = null
}

onBeforeUnmount(() => {
  if (cy) { cy.destroy(); cy = null }
})
</script>

<style scoped>
.graphs-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header-row {
  text-align: center;
  margin-bottom: 2rem;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  padding: 1.5rem;
}

.card h3 { margin-top: 0; }

.row { display: flex; flex-wrap: wrap; gap: 1rem; }

.field { flex: 1; min-width: 200px; }

.primary { background-color: #2563eb; color: white; }
.secondary { background-color: #f3f4f6; color: #111827; }

.result {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-top: 1rem;
  padding: 1rem;
}

.graph-wrapper { position: relative; width: 100%; padding-top: 75%; /* 4:3 */ }
.cy { position: absolute; inset: 0; width: 100%; height: 100%; }

.detail-panel {
  background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,.1);
  padding: 1rem; position: absolute; top: 1rem; right: 1rem; width: 300px; max-width: 100%; z-index: 10;
}
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.detail-body { font-size: .875rem; }

.k { font-weight: 500; color: #374151; }
.v { font-weight: 400; color: #111827; }
.copy-ok { color: #16a34a; font-size: .875rem; margin-top: .5rem; }

.error { color: #dc2626; margin-top: 1rem; text-align: center; }

.comp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
.comp-item { background: #f3f4f6; border-radius: 8px; padding: 1rem; cursor: pointer; transition: transform .2s; }
.comp-item:hover { transform: translateY(-2px); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: .5rem; vertical-align: middle; background: var(--comp-color); }

.muted { color: #6b7280; }

/* Botones coherentes */
.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.primary:disabled, .secondary:disabled { opacity: .6; cursor: not-allowed; }
</style>
