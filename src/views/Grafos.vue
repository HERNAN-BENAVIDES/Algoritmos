<!-- Grafos.vue -->
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

        <button class="secondary" @click="clearComponentsView" :disabled="!cy">
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
      {
        selector: '.path-node',
        style: { 'background-color': '#d97706', 'border-color': '#92400e', 'border-width': 2 }
      },
      {
        selector: '.path-edge',
        style: { 'line-color': '#d97706', 'target-arrow-color': '#d97706', 'width': 4, 'opacity': 0.95 }
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
    clearPathClasses()
    const n = evt.target
    detail.value = {
      visible: true,
      type: 'node',
      node: { id: n.id(), title: n.data('title'), year: n.data('year') },
      edge: null
    }
  })

  cy.on('tap', 'edge', (evt) => {
    clearPathClasses()
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

/* ----------------- camino mínimo ----------------- */
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
function highlightPath(pathIds) {
  if (!cy || !Array.isArray(pathIds) || pathIds.length < 2) return
  clearPathClasses()
  pathIds.forEach(id => {
    const n = cy.getElementById(id)
    if (n && n.nonempty()) n.addClass('path-node')
  })
  for (let i = 0; i < pathIds.length - 1; i++) {
    const u = pathIds[i], v = pathIds[i + 1]
    const e = cy.$(`edge[source = "${u}"][target = "${v}"]`)
    if (e && e.nonempty()) e.addClass('path-edge')
  }
  const eles = cy.$('.path-node').union(cy.$('.path-edge'))
  if (eles.nonempty()) cy.animate({ fit: { eles, padding: 60 }, duration: 450, easing: 'ease' })
}

/* ----------------- componentes ----------------- */
const compType = ref('weak')
const compList = ref([])
const singletonGray = '#9ca3af'
const compPalette = [
  '#2563eb','#16a34a','#dc2626','#7c3aed','#0891b2','#ca8a04',
  '#9333ea','#059669','#ef4444','#0ea5e9','#d946ef','#f59e0b'
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

  // Map de pertenencia (nodo -> índice componente) y tamaños
  const belong = new Map()
  const compSizes = new Map()
  components.forEach((arr, idx) => {
    compSizes.set(idx, (arr || []).length)
    ;(arr || []).forEach(id => belong.set(id, idx))
  })

  cy.nodes().forEach(n => {
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
      // No listado en ningún componente → atenuado
      n.style({ 'opacity': 0.15 })
    }
  })

  cy.edges().forEach(e => {
    const s = e.source().id()
    const t = e.target().id()
    const is = belong.get(s)
    const it = belong.get(t)
    const sameComp = (is != null && it != null && is === it)
    const compSize = sameComp ? (compSizes.get(is) || 0) : 0
    // Si la arista conecta dos nodos del mismo componente no-solitario → resaltar un poco más
    e.style({ 'opacity': sameComp && compSize > 1 ? 0.9 : 0.12 })
  })

  fitView()
}

function focusComponent(idx) {
  if (!cy || !Array.isArray(compList.value[idx])) return
  const ids = compList.value[idx]
  const size = ids.length
  const baseColor = compColor(idx, size)
  const col = cy.collection(ids.map(id => cy.getElementById(id)).filter(x => x && x.nonempty()))

  cy.nodes().forEach(n => {
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
    const inComp = ids.includes(e.source().id()) && ids.includes(e.target().id())
    e.style({ 'opacity': inComp && size > 1 ? 0.9 : 0.08 })
  })

  if (col.length) cy.animate({ fit: { eles: col, padding: 60 }, duration: 450, easing: 'ease' })
}

function clearComponentsView() {
  if (!cy) return
  cy.nodes().forEach(n => {
    const deg = n.degree(false)
    const size = Math.max(10, Math.min(28, 10 + Math.log2(deg + 2) * 6))
    n.style({
      'background-color': '#2b8a3e',
      'border-color': '#1b4332',
      'border-width': 1,
      'width': size,
      'height': size,
      'opacity': 1
    })
  })
  cy.edges().forEach(e => {
    const s = Number(e.data('similarity') ?? 0)
    e.style({
      'line-color': '#3c78c8',
      'target-arrow-color': '#3c78c8',
      'width': 1 + 3 * Math.max(0, Math.min(1, s)),
      'opacity': 0.25 + 0.6 * Math.max(0, Math.min(1, s))
    })
  })
  compList.value = []
  fitView()
}

/* ----------------- ciclo de vida ----------------- */
function onResize() { if (cy) cy.resize() }
onMounted(() => { window.addEventListener('resize', onResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); if (cy) cy.destroy() })
</script>

<style scoped>
.graphs-view { padding: 0.5rem 0 1rem; display: grid; gap: 1rem; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .25rem; }

.card { border: 1px solid #eaeaea; border-radius: 12px; padding: .85rem; background: #fff; }
.card h3 { margin: 0 0 .5rem; font-size: 1.1rem; }
.row { display: flex; align-items: flex-end; gap: .5rem; flex-wrap: wrap; }
.row.wrap { align-items: center; }
.field { display: grid; gap: .25rem; min-width: 220px; }
.field input, .field select { padding: .5rem .6rem; border: 1px solid #dcdcdc; border-radius: 8px; }

.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.primary:disabled, .secondary:disabled { opacity: .6; cursor: not-allowed; }

.result { margin-top: .5rem; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: .5rem; }
.result pre { max-height: 320px; overflow: auto; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: .5rem; }

.graph-wrapper { position: relative; border: 1px dashed #e5e7eb; border-radius: 10px; background: #f9fafb; margin-top: .6rem; }
.cy {
  width: 100%;
  height: clamp(520px, 72vh, 980px);
  display: block;
  box-sizing: border-box;
}

.detail-panel {
  position: absolute;
  right: 10px; top: 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.08);
  width: min(480px, 92%);
  max-height: 75vh;
  overflow: auto;
  padding: .6rem .6rem .8rem;
}
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .4rem; }
.icon-btn { background: transparent; border: none; font-size: 1rem; cursor: pointer; color: #6b7280; }
.icon-btn:hover { color: #111827; }
.detail-body { display: grid; gap: .4rem; }
.kv { display: grid; grid-template-columns: 120px 1fr; column-gap: .6rem; }
.k { color: #6b7280; }
.v { color: #111827; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.copy-ok { color: #16a34a; margin: .2rem 0 0; }
.wfull { width: 100%; }

.comp-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: .45rem;
  margin-top: .6rem;
}
.comp-item {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .45rem .6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  background: #fff;
  transition: background .15s ease;
  --comp-color: #999;
}
.comp-item:hover { background: #f9fafb; }
.comp-item .dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--comp-color, #999);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05) inset;
}
.comp-item .muted { color: #6b7280; font-size: .9rem; }

.error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; padding: .5rem; border-radius: 8px; }
</style>
