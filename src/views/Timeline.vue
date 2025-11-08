<template>
  <div class="timeline-view">
    <div class="header-row">
      <h2>Línea temporal de publicaciones</h2>
      <div class="actions">
        <button class="primary" @click="loadData" :disabled="loading">{{ loading ? 'Cargando…' : 'Actualizar' }}</button>
        <label class="field">
          Mostrar revistas
          <input type="checkbox" v-model="showRevistas" />
        </label>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="chart-wrapper">
      <div v-if="loading" class="loading">Cargando línea…</div>
      <div v-show="!loading" ref="chartEl" class="chart"></div>
    </div>

    <div class="bottom-panels">
      <section class="legend">
        <h3>Resumen</h3>
        <p><strong>Años:</strong> {{ years.length }}</p>
        <p><strong>Publicaciones totales:</strong> {{ totalPublications }}</p>

        <details v-if="data?.venues?.length">
          <summary>Revistas ({{ data.venues.length }})</summary>

          <div class="revistas-controls">
            <input
              v-model="revistaQuery"
              type="text"
              class="search"
              placeholder="Buscar revista…"
              :disabled="!showRevistas"
            />
            <div class="revistas-actions">
              <button class="secondary" @click="clearSelection" :disabled="!selectedRevistas.size">Limpiar selección</button>
              <span class="hint">Seleccionadas: {{ selectedRevistas.size || '0' }}</span>
            </div>
          </div>

          <ul class="revistas-list" ref="revistasListEl" @scroll="onListScroll">
            <div class="virtual-spacer" :style="{ height: totalListHeight + 'px' }">
              <div class="virtual-inner" :style="{ transform: `translateY(${topPadding}px)` }">
                <li
                  v-for="r in visibleRevistas"
                  :key="r.name"
                  :class="['revista-item', { selected: selectedRevistas.has(r.name) }]"
                  @click="onRevistaClick(r.name)"
                  @dblclick.prevent="onRevistaDblClick(r.name)"
                  :title="`${r.name} · total ${r.total}`"
                  :style="{ height: rowHeight + 'px' }"
                >
                  <span class="name">{{ r.name }}</span>
                  <span class="total">{{ r.total }}</span>
                </li>
              </div>
            </div>
          </ul>
        </details>

        <details>
          <summary>Datos crudos</summary>
          <pre>{{ pretty(data) }}</pre>
        </details>
      </section>

      <aside class="help">
        <h3>Cómo funciona</h3>
        <ul>
          <li>Un clic sobre una revista: selecciona o deselecciona esa revista.</li>
          <li>Dos clics (doble clic) sobre una revista: selección exclusiva (solo esa revista).</li>
          <li>Si vuelves a hacer doble clic sobre la misma revista, se limpia la selección exclusiva anterior.</li>
          <li>Usa “Mostrar revistas” para ocultar/mostrar todas las líneas de revistas (mantiene la selección).</li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Plotly from 'plotly.js-dist'
import { fetchTimeline } from '@/lib/api'

const loading = ref(false)
const error = ref('')
const data = ref(null)
const chartEl = ref(null)

// Renombrado: antes showVenues
const showRevistas = ref(true)

// Estado para lista de revistas
const revistaQuery = ref('')
const selectedRevistas = ref(new Set())

const years = computed(() => data.value ? Object.keys(data.value.publicationsByYear || {}).map(y => Number(y)).sort((a,b)=>a-b) : [])
const totalPublications = computed(() => years.value.reduce((acc, y) => acc + (data.value.publicationsByYear?.[y] || 0), 0))

// Totales por revista (suma en todos los años)
const revistaTotals = computed(() => {
  const result = {}
  const byYearVenue = data.value?.publicationsByYearAndVenue || {}
  for (const y of Object.keys(byYearVenue)) {
    const venues = byYearVenue[y] || {}
    for (const v of Object.keys(venues)) {
      result[v] = (result[v] || 0) + (venues[v] || 0)
    }
  }
  return result
})

const revistas = computed(() => {
  const arr = (data.value?.venues || []).map(name => ({ name, total: revistaTotals.value[name] || 0 }))
  // Ordenar por total desc, luego alfabético
  return arr.sort((a,b) => (b.total - a.total) || a.name.localeCompare(b.name))
})

const filteredRevistas = computed(() => {
  const q = revistaQuery.value.trim().toLowerCase()
  if (!q) return revistas.value
  return revistas.value.filter(r => r.name.toLowerCase().includes(q))
})

function pretty(obj) { try { return JSON.stringify(obj, null, 2) } catch { return String(obj) } }

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchTimeline()
    renderChart()
  } catch (e) {
    error.value = e.message || 'Error cargando línea temporal'
  } finally {
    loading.value = false
  }
}

function clearSelection() {
  selectedRevistas.value = new Set()
  renderChart()
}

let clickTimer = null
function onRevistaClick(name) {
  // Diferenciar de doble clic con un pequeño retardo
  if (clickTimer) return
  clickTimer = setTimeout(() => {
    clickTimer = null
    const set = new Set(selectedRevistas.value)
    if (set.has(name)) set.delete(name); else set.add(name);
    selectedRevistas.value = set
    renderChart()
  }, 200)
}

function onRevistaDblClick(name) {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  const set = new Set(selectedRevistas.value)
  // Si ya es selección exclusiva (solo esa), limpiar selección
  if (set.size === 1 && set.has(name)) {
    selectedRevistas.value = new Set()
  } else {
    selectedRevistas.value = new Set([name])
  }
  renderChart()
}

function renderChart() {
  if (!chartEl.value || !data.value) return
  const byYear = data.value.publicationsByYear || {}
  const byYearVenue = data.value.publicationsByYearAndVenue || {}
  const allVenues = data.value.venues || []

  const xYears = Object.keys(byYear).map(Number).sort((a,b)=>a-b)
  const totalTrace = {
    x: xYears,
    y: xYears.map(y => byYear[y] || 0),
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Total',
    line: { width: 3, color: '#0b5ed7' },
    marker: { size: 7 }
  }

  const traces = [totalTrace]

  if (showRevistas.value) {
    const target = selectedRevistas.value.size ? Array.from(selectedRevistas.value) : allVenues
    target.forEach(venue => {
      const yVals = xYears.map(y => (byYearVenue[y] && byYearVenue[y][venue]) ? byYearVenue[y][venue] : 0)
      const nonZero = yVals.some(v => v > 0)
      if (!nonZero) return
      traces.push({
        x: xYears,
        y: yVals,
        type: 'scatter',
        mode: 'lines+markers',
        name: venue,
        line: { width: 2 },
        marker: { size: 5 }
      })
    })
  }

  const layout = {
    title: 'Publicaciones por año',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    hovermode: 'x unified',
    margin: { l: 55, r: 20, t: 50, b: 50 },
    xaxis: { title: 'Año', dtick: 1, tickmode: 'linear' },
    yaxis: { title: 'Publicaciones', rangemode: 'tozero' },
    legend: { orientation: 'h', y: -0.2 }
  }

  Plotly.newPlot(chartEl.value, traces, layout, { responsive: true })
}

// Virtual list setup
const revistasListEl = ref(null)
const rowHeight = 36 // px por fila
const overscan = 6   // filas extra arriba/abajo
const scrollTop = ref(0)
const viewportHeight = ref(0)

const totalListHeight = computed(() => filteredRevistas.value.length * rowHeight)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - overscan))
const visibleCount = computed(() => Math.ceil((viewportHeight.value || 1) / rowHeight) + overscan * 2)
const endIndex = computed(() => Math.min(filteredRevistas.value.length, startIndex.value + visibleCount.value))
const topPadding = computed(() => startIndex.value * rowHeight)
const visibleRevistas = computed(() => filteredRevistas.value.slice(startIndex.value, endIndex.value))

let raf = null
function onListScroll() {
  if (!revistasListEl.value) return
  const st = revistasListEl.value.scrollTop
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => { scrollTop.value = st })
}

function measureListViewport() {
  viewportHeight.value = revistasListEl.value ? revistasListEl.value.clientHeight : 0
}

function onResize() { measureListViewport() }

onMounted(() => {
  measureListViewport()
  window.addEventListener('resize', onResize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (raf) cancelAnimationFrame(raf)
})

watch(filteredRevistas, () => {
  // Al cambiar el filtro, resetear scroll para UX más predecible
  if (revistasListEl.value) revistasListEl.value.scrollTop = 0
  scrollTop.value = 0
})

onMounted(loadData)
watch(showRevistas, () => renderChart())
</script>

<style scoped>
.timeline-view { display: grid; gap: 1rem; }
.header-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .75rem; }
.actions { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .55rem .95rem; cursor: pointer; }
.primary:disabled { opacity: .6; cursor: not-allowed; }
.field { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
.error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; padding: .5rem .75rem; border-radius: 8px; }
.chart-wrapper { position: relative; min-height: 460px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.chart { width: 100%; height: 100%; }
.loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #0b5ed7; }

.bottom-panels { display: grid; gap: 1rem; grid-template-columns: 1fr; }
@media (min-width: 900px) { .bottom-panels { grid-template-columns: 3fr 2fr; align-items: start; } }

.legend { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: .75rem .9rem; font-size: .9rem; }
.legend ul { list-style: none; margin: 0; padding: 0; }
.legend pre { max-height: 300px; overflow: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: .5rem; }

.revistas-controls { display: grid; gap: .5rem; margin: .5rem 0; }
.search { width: 100%; padding: .45rem .6rem; border: 1px solid #d0d7de; border-radius: 8px; }
.revistas-actions { display: flex; align-items: center; gap: .5rem; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: .4rem .7rem; cursor: pointer; }
.hint { color: #475569; font-size: .85rem; }

.revistas-list { max-height: 260px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; }
.virtual-spacer { position: relative; width: 100%; }
.virtual-inner { position: absolute; left: 0; right: 0; will-change: transform; }
.revista-item { display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: 0 .55rem; cursor: pointer; border-bottom: 1px dashed #eef2f7; box-sizing: border-box; }
.revista-item:last-child { border-bottom: none; }
.revista-item:hover { background: #f6faff; }
.revista-item.selected { background: #e9f2ff; }
.revista-item .name { flex: 1; }
.revista-item .total { color: #334155; font-weight: 600; }

.help { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: .75rem .9rem; font-size: .92rem; }
.help ul { margin: .4rem 0 0; padding-left: 1.1rem; }
.help li { margin: .25rem 0; }
</style>
