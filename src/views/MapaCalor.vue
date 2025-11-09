<!-- MapaCalor.vue-->
<template>
  <div class="heatmap-view">
    <div class="header-row">
      <h2>Mapa de calor – País del primer autor</h2>
      <div class="actions">
        <button class="primary" @click="loadData" :disabled="loading">{{ loading ? 'Cargando…' : 'Actualizar' }}</button>
        <button class="secondary" @click="exportPdf" :disabled="loading || !countries.length">Exportar PDF</button>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div ref="exportEl" class="export-wrapper">
      <div class="chart-wrapper">
        <div v-if="loading" class="loading">Cargando datos…</div>
        <div v-show="!loading" ref="chartEl" class="chart"></div>
      </div>
      <div v-if="countries.length" class="legend">
        <h3>Totales</h3>
        <ul>
          <li v-for="c in countries" :key="c.country">{{ labelFor(c.country) }}: <strong>{{ c.count }}</strong></li>
        </ul>
      </div>
    </div>

    <p v-if="!loading && !countries.length && !error" class="empty">No hay datos para mostrar.</p>

    <details class="debug" v-if="rawData">
      <summary>Depuración: respuesta del backend</summary>
      <pre>{{ pretty(rawData) }}</pre>
    </details>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { mapFirstAuthorCountries } from '@/lib/api'
import { exportSingleElement } from '@/lib/exportPdf'

// Mapeos básicos ISO3->ISO2 y nombres ES/EN -> ISO2 (cobertura de países más comunes)
const iso3to2 = {
  USA: 'US', COL: 'CO', MEX: 'MX', ARG: 'AR', CHL: 'CL', PER: 'PE', BRA: 'BR', ECU: 'EC', VEN: 'VE',
  CAN: 'CA', ESP: 'ES', FRA: 'FR', DEU: 'DE', ITA: 'IT', GBR: 'GB', PRT: 'PT', AUS: 'AU', NZL: 'NZ',
  CHN: 'CN', JPN: 'JP', KOR: 'KR', IND: 'IN', RUS: 'RU', ZAF: 'ZA'
}
const nameToISO2 = {
  'Colombia': 'CO', 'Estados Unidos': 'US', 'United States': 'US', 'México': 'MX', 'Mexico': 'MX',
  'Argentina': 'AR', 'Chile': 'CL', 'Perú': 'PE', 'Brazil': 'BR', 'Brasil': 'BR', 'Ecuador': 'EC', 'Venezuela': 'VE',
  'Canadá': 'CA', 'Canada': 'CA', 'España': 'ES', 'Spain': 'ES', 'Francia': 'FR', 'France': 'FR', 'Alemania': 'DE', 'Germany': 'DE',
  'Italia': 'IT', 'Italy': 'IT', 'Reino Unido': 'GB', 'United Kingdom': 'GB', 'Portugal': 'PT', 'Australia': 'AU',
  'Nueva Zelanda': 'NZ', 'New Zealand': 'NZ', 'China': 'CN', 'Japón': 'JP', 'Japan': 'JP', 'Corea del Sur': 'KR', 'South Korea': 'KR',
  'India': 'IN', 'Rusia': 'RU', 'Russia': 'RU', 'Sudáfrica': 'ZA', 'South Africa': 'ZA'
}
const regionNamesEs = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['es'], { type: 'region' }) : null

function parseCountry(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { code: null, name: '' }
  const upper = s.toUpperCase()
  // ISO2
  if (/^[A-Z]{2}$/.test(upper)) {
    const code = upper
    const name = regionNamesEs?.of(code) || s
    return { code, name }
  }
  // ISO3
  if (/^[A-Z]{3}$/.test(upper)) {
    const code = iso3to2[upper] || null
    const name = code ? (regionNamesEs?.of(code) || s) : s
    return { code, name }
  }
  // Nombre -> ISO2
  let code = nameToISO2[s]
  if (!code) {
    const key = Object.keys(nameToISO2).find(k => k.toLowerCase() === s.toLowerCase())
    if (key) code = nameToISO2[key]
  }
  const name = s
  return { code: code || null, name }
}

function labelFor(raw) {
  const { code, name } = parseCountry(raw)
  return `${name}${code ? ` (${code})` : ''}`
}

const loading = ref(false)
const error = ref('')
const countries = ref([])
const rawData = ref(null)
const chartEl = ref(null)
const exportEl = ref(null)
let googleLoaded = false

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}

function ensureGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.charts) {
      if (!googleLoaded) {
        window.google.charts.load('current', { packages: ['geochart'] })
        window.google.charts.setOnLoadCallback(() => { googleLoaded = true; resolve() })
      } else {
        resolve()
      }
      return
    }
    const scriptId = 'google-charts-loader'
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script')
      s.id = scriptId
      s.src = 'https://www.gstatic.com/charts/loader.js'
      s.async = true
      s.onload = () => {
        if (window.google && window.google.charts) {
          window.google.charts.load('current', { packages: ['geochart'] })
          window.google.charts.setOnLoadCallback(() => { googleLoaded = true; resolve() })
        } else {
          reject(new Error('Google Charts no disponible'))
        }
      }
      s.onerror = () => reject(new Error('No se pudo cargar Google Charts'))
      document.head.appendChild(s)
    } else {
      const check = setInterval(() => {
        if (window.google && window.google.charts) {
          clearInterval(check)
          if (!googleLoaded) {
            window.google.charts.load('current', { packages: ['geochart'] })
            window.google.charts.setOnLoadCallback(() => { googleLoaded = true; resolve() })
          } else {
            resolve()
          }
        }
      }, 200)
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout cargando Google Charts')) }, 12000)
    }
  })
}

async function loadData() {
  loading.value = true
  error.value = ''
  rawData.value = null
  try {
    await ensureGoogle()
    const data = await mapFirstAuthorCountries()
    rawData.value = data
    countries.value = Array.isArray(data) ? data : []
    renderChart()
  } catch (e) {
    console.error('[MapaCalor] Error:', e)
    error.value = e.message || 'Fallo al cargar datos'
  } finally {
    loading.value = false
  }
}

function renderChart() {
  if (!chartEl.value || !window.google || !window.google.visualization) return
  const dataTable = new window.google.visualization.DataTable()
  dataTable.addColumn('string', 'Country')
  dataTable.addColumn('number', 'Artículos (primer autor)')
  dataTable.addColumn({ type: 'string', role: 'tooltip' })

  countries.value.forEach(c => {
    const info = parseCountry(c.country)
    const geoKey = info.code || info.name || String(c.country)
    const tooltip = `${info.name}${info.code ? ` (${info.code})` : ''}: ${Number(c.count || 0)}`
    dataTable.addRow([geoKey, Number(c.count || 0), tooltip])
  })

  const chart = new window.google.visualization.GeoChart(chartEl.value)
  chart.draw(dataTable, {
    colorAxis: { colors: ['#e0f2fe', '#0369a1'] },
    backgroundColor: '#ffffff',
    datalessRegionColor: '#f1f5f9',
    legend: 'none'
  })
}

async function exportPdf() {
  try {
    if (!exportEl.value) throw new Error('Elemento no disponible')
    await exportSingleElement(exportEl.value, 'mapa_calor.pdf')
  } catch (e) {
    console.error('[MapaCalor] Exportación fallida:', e)
    alert(e.message || 'No se pudo exportar el PDF')
  }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.heatmap-view { display: grid; gap: 1rem; }
.header-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.actions { display: flex; gap: .5rem; }
.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .5rem .9rem; cursor: pointer; }
.primary:disabled { opacity: .6; cursor: not-allowed; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: .45rem .85rem; cursor: pointer; }
.secondary:disabled { opacity: .6; cursor: not-allowed; }
.error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; padding: .5rem .75rem; border-radius: 8px; }
.export-wrapper { display: grid; gap: 1rem; }
.chart-wrapper { position: relative; min-height: 460px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.chart { width: 100%; height: 100%; }
.loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #0b5ed7; }
.legend { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: .75rem .9rem; }
.legend h3 { margin: 0 0 .5rem; font-size: 1rem; }
.legend ul { list-style: none; margin: 0; padding: 0; columns: 2; }
.legend li { padding: .25rem 0; font-size: .9rem; }
.empty { color: #475569; background: #f8fafc; border: 1px dashed #cbd5e1; padding: .5rem .75rem; border-radius: 8px; }
.debug { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: .5rem; }
.debug pre { max-height: 300px; overflow: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: .5rem; }
</style>
