<template>
  <div class="cooc-view">
    <div class="header-row">
      <h2>Grafo de coocurrencia (términos)</h2>
    </div>

    <section class="card">
      <h3>Construcción</h3>
      <div class="row">
        <button class="primary" :disabled="loading.build" @click="onBuild">Construir grafo</button>
      </div>

      <div v-if="buildResult" class="result">
        <div class="row wrap">
          <div><strong>Términos (nodos):</strong> {{ buildResult.export?.nodes?.length ?? '—' }}</div>
          <div><strong>Coocurrencias (aristas):</strong> {{ buildResult.export?.edges?.length ?? '—' }}</div>
          <div><strong>Vocabulario combinado:</strong> {{ buildResult.vocabularySize ?? '—' }}</div>
        </div>
        <details>
          <summary>Export (JSON)</summary>
          <pre>{{ pretty(buildResult.export) }}</pre>
        </details>
      </div>

      <!-- Lienzo del grafo -->
      <div class="graph-wrapper">
        <div ref="cyContainer" class="cy"></div>

        <!-- Panel lateral de detalles -->
        <div v-if="detail.visible" class="detail-panel" @click.stop>
          <header class="detail-header">
            <strong>{{ detail.type === 'node' ? 'Término' : 'Coocurrencia' }}</strong>
            <button class="icon-btn" @click="detail.visible = false" title="Cerrar">✕</button>
          </header>

          <div v-if="detail.type === 'node'" class="detail-body">
            <div class="kv"><span class="k">ID</span><span class="v mono">{{ detail.node?.id }}</span></div>
            <div class="kv"><span class="k">Etiqueta</span><span class="v">{{ detail.node?.label || detail.node?.id }}</span></div>
            <div class="kv"><span class="k">Grado</span><span class="v">{{ detail.node?.degree }}</span></div>
            <div class="kv"><span class="k">Fuerza</span><span class="v">{{ detail.node?.strength }}</span></div>
          </div>

          <div v-else class="detail-body">
            <div class="kv"><span class="k">Término A</span><span class="v mono">{{ detail.edge?.a }}</span></div>
            <div class="kv"><span class="k">Término B</span><span class="v mono">{{ detail.edge?.b }}</span></div>
            <div class="kv"><span class="k">Peso (docs)</span><span class="v">{{ detail.edge?.weight }}</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Componentes (no dirigidos)</h3>

      <div class="row wrap">
        <button class="secondary" :disabled="!cy" @click="computeAndColorComponents">Detectar componentes</button>
        <button class="secondary" :disabled="!cy" @click="resetStyles">Limpiar</button>
      </div>

      <div v-if="components.length" class="comp-list">
        <div
            v-for="(ids, idx) in components"
            :key="idx"
            class="comp-item"
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
import { API_BASE, buildCooccurrence } from '@/lib/api'

/* ------- estado ------- */
const loading = ref({ build: false })
const error = ref('')
const buildResult = ref(null)

const cyContainer = ref(null)
let cy = null

/* detalle */
const detail = ref({ visible: false, type: 'node', node: null, edge: null })

/* componentes */
const components = ref([])
const singletonGray = '#9ca3af'
const palette = [
  '#2563eb','#16a34a','#dc2626','#7c3aed','#0891b2','#ca8a04',
  '#9333ea','#059669','#ef4444','#0ea5e9','#d946ef','#f59e0b'
]
function compColor(i, size){ return size===1 ? singletonGray : palette[i % palette.length] }

/* ------- helpers ------- */
function pretty(o){ try { return JSON.stringify(o, null, 2) } catch { return String(o) } }
function toAbsolute(p){ if (!p) return '#'; return /^https?:\/\//i.test(p) ? p : `${API_BASE}${p.startsWith('/') ? p : '/'+p}` }
async function safeRun(k, fn){
  try{ loading.value[k]=true; error.value=''; return await fn() }
  catch(e){ error.value = e?.message || 'Error inesperado'; return null }
  finally{ loading.value[k]=false }
}

/* ------- construcción ------- */
async function onBuild(){
  const res = await safeRun('build', buildCooccurrence)
  if (!res) return
  buildResult.value = res
  render(res.export)
}

function render(exp){
  if (cy) { cy.destroy(); cy=null }
  const nodes = (exp?.nodes ?? []).map((id, idx) => ({
    data: { id, label: exp?.labels?.[id] ?? exp?.nodesLabels?.[idx] ?? id }
  }))
  const edges = (exp?.edges ?? []).map(e => ({
    data: { id: `${e.a}__${e.b}`, source: e.a, target: e.b, weight: e.weight }
  }))

  cy = cytoscape({
    container: cyContainer.value,
    elements: [...nodes, ...edges],
    style: [
      { selector: 'node', style: {
          'shape':'ellipse',
          'background-color':'#374151',
          'border-color':'#111827',
          'border-width':1,
          'label':'data(label)',
          'font-size': 10,
          'text-wrap':'wrap',
          'text-max-width': 120,
          'text-valign':'center',
          'color':'#111827',
          'text-background-color':'#ffffff',
          'text-background-opacity': 0.9,
          'text-background-padding': 2,
          'width': (el)=> nodeSize(el),
          'height': (el)=> nodeSize(el)
        }},
      { selector: 'edge', style: {
          'curve-style':'bezier',
          'line-color':'#64748b',
          'width': (e)=> 1 + Math.min(5, Number(e.data('weight')||1)),
          'opacity': 0.55
        }},
      { selector: '.comp-highlight', style: { 'background-color': '#2563eb', 'border-color': '#0f172a', 'border-width': 2 } },
      { selector: '.edge-strong', style: { 'opacity': 0.95, 'line-color':'#0ea5e9', 'width': 3 } }
    ],
    layout: { name: 'cose', animate:false, fit:true, padding: 40, nodeRepulsion: 2000, idealEdgeLength: 80, gravity: 0.25 },
    wheelSensitivity: 0.2
  })

  cy.once('layoutstop', fitView)

  // detalles
  cy.on('tap', 'node', (evt)=>{
    const n = evt.target
    const deg = n.degree(false)
    const strength = n.connectedEdges().reduce((s,e)=> s + Number(e.data('weight')||0), 0)
    detail.value = { visible:true, type:'node', node:{
        id: n.id(), label: n.data('label'), degree: deg, strength
      }, edge:null }
  })

  cy.on('tap', 'edge', (evt)=>{
    const e = evt.target
    detail.value = { visible:true, type:'edge', node:null, edge:{
        a: e.source().id(), b: e.target().id(), weight: e.data('weight')
      }}
  })

  cy.on('tap', (evt)=>{ if (evt.target===cy) detail.value = { visible:false, type:'node', node:null, edge:null } })
  fitView()
}

function nodeSize(el){
  // tamaño por “centralidad” simple: grado y fuerza
  const deg = el.degree(false)
  const strength = el.connectedEdges().reduce((s,e)=> s + Number(e.data('weight')||0), 0)
  const base = 16
  const inc = Math.log2(2 + deg) + Math.log10(2 + strength)
  return Math.max(14, Math.min(40, base + 6*inc))
}

function fitView(){ if (cy) cy.fit(cy.elements(), 40) }
function resetStyles(){
  if (!cy) return
  cy.nodes().forEach(n=>{
    n.removeClass('comp-highlight')
    n.style({ 'background-color':'#374151', 'border-color':'#111827', 'border-width':1, 'opacity': 1 })
  })
  cy.edges().forEach(e=>{
    e.removeClass('edge-strong')
    e.style({ 'opacity': 0.55, 'line-color':'#64748b', 'width': 1 + Math.min(5, Number(e.data('weight')||1)) })
  })
  components.value = []
  fitView()
}

/* ------- componentes (no dirigido) ------- */
function computeAndColorComponents(){
  if (!cy) return
  // BFS sobre el grafo no dirigido
  const all = cy.nodes().map(n=> n.id())
  const seen = new Set()
  const comps = []
  for (const id of all){
    if (seen.has(id)) continue
    const q=[id], comp=[]
    seen.add(id)
    while(q.length){
      const u = q.shift()
      comp.push(u)
      const neigh = cy.getElementById(u).connectedEdges().connectedNodes().difference(cy.getElementById(u))
      neigh.forEach(v=>{
        const vid = v.id()
        if (!seen.has(vid)){ seen.add(vid); q.push(vid) }
      })
    }
    comps.push(comp)
  }
  // ordenar por tamaño desc
  comps.sort((a,b)=> b.length - a.length)
  components.value = comps

  // colorear
  const belong = new Map()
  comps.forEach((arr, idx)=> arr.forEach(id=> belong.set(id, idx)))
  cy.nodes().forEach(n=>{
    const idx = belong.get(n.id())
    const size = components.value[idx]?.length ?? 0
    const col = compColor(idx, size)
    n.style({
      'background-color': col,
      'border-color': size===1 ? '#6b7280' : '#111827',
      'border-width': size===1 ? 1 : 2,
      'opacity': 1
    })
  })
  cy.edges().forEach(e=>{
    const a = e.source().id(), b = e.target().id()
    const ia = belong.get(a), ib = belong.get(b)
    const same = ia!=null && ib!=null && ia===ib
    const size = same ? (components.value[ia]?.length ?? 0) : 0
    e.style({ 'opacity': same && size>1 ? 0.9 : 0.12, 'line-color': same && size>1 ? '#0ea5e9' : '#94a3b8', 'width': same && size>1 ? 3 : 1 })
  })
  fitView()
}

function focusComponent(idx){
  if (!cy || !Array.isArray(components.value[idx])) return
  const ids = components.value[idx]
  const size = ids.length
  const baseColor = compColor(idx, size)
  const col = cy.collection(ids.map(id => cy.getElementById(id)).filter(x => x && x.nonempty()))
  cy.nodes().forEach(n=>{
    if (ids.includes(n.id())){
      n.style({ 'opacity':1, 'background-color': baseColor, 'border-color': size===1 ? '#6b7280' : '#111827', 'border-width': size===1 ? 1 : 2 })
    }else{
      n.style({ 'opacity':0.12 })
    }
  })
  cy.edges().forEach(e=>{
    const inComp = ids.includes(e.source().id()) && ids.includes(e.target().id())
    e.style({ 'opacity': inComp && size>1 ? 0.9 : 0.08, 'line-color': inComp ? '#0ea5e9' : '#cbd5e1', 'width': inComp ? 3 : 1 })
  })
  if (col.length) cy.animate({ fit: { eles: col, padding: 60 }, duration: 450, easing: 'ease' })
}

/* ------- ciclo de vida ------- */
function onResize(){ if (cy) cy.resize() }
onMounted(()=> window.addEventListener('resize', onResize))
onBeforeUnmount(()=> { window.removeEventListener('resize', onResize); if (cy) cy.destroy() })
</script>

<style scoped>
.cooc-view { padding: .5rem 0 1rem; display: grid; gap: 1rem; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .25rem; }

.card { border: 1px solid #eaeaea; border-radius: 12px; padding: .85rem; background: #fff; }
.card h3 { margin: 0 0 .5rem; font-size: 1.1rem; }
.row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }

.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.primary:disabled, .secondary:disabled { opacity: .6; cursor: not-allowed; }

.result { margin-top: .5rem; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: .5rem; }
.result pre { max-height: 320px; overflow: auto; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: .5rem; }
.image-link { margin-top: .4rem; }

.graph-wrapper { position: relative; border: 1px dashed #e5e7eb; border-radius: 10px; background: #f9fafb; margin-top: .6rem; }
.cy { width: 100%; height: clamp(520px, 72vh, 980px); display: block; box-sizing: border-box; }

.detail-panel {
  position: absolute; right: 10px; top: 10px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.08);
  width: min(480px, 92%); max-height: 75vh; overflow: auto;
  padding: .6rem .6rem .8rem;
}
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .4rem; }
.icon-btn { background: transparent; border: none; font-size: 1rem; cursor: pointer; color: #6b7280; }
.icon-btn:hover { color: #111827; }
.detail-body { display: grid; gap: .4rem; }
.kv { display: grid; grid-template-columns: 120px 1fr; column-gap: .6rem; }
.k { color: #6b7280; }
.v { color: #111827; }
.mono { font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

.comp-list {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: .45rem; margin-top: .6rem;
}
.comp-item {
  display: inline-flex; align-items: center; gap: .5rem;
  padding: .45rem .6rem; border: 1px solid #e5e7eb; border-radius: 8px;
  cursor: pointer; background: #fff; transition: background .15s ease;
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