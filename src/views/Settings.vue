<template>
  <div class="keyword-view">
    <div class="header-row">
      <h2>Análisis de Keywords</h2>
      <button class="btn-run" @click="runAnalysis" :disabled="loading">
        {{ loading ? 'Analizando…' : 'Ejecutar análisis' }}
      </button>
    </div>

    <div v-if="error" class="message error">{{ error }}</div>

    <div v-if="result" class="result-wrap">
      <div class="summary">
        <div class="summary-main">
          <div class="category" :title="result.category">
            Categoría: <strong>{{ result.category }}</strong>
          </div>
          <div class="precision">
            Precisión: <strong>{{ formatPrecision(result.precision) }}</strong>
          </div>
        </div>
        <div class="precision-explanation" v-if="result.precisionExplanation">
          {{ result.precisionExplanation }}
        </div>
      </div>

      <div class="cards-two-cols">
        <div class="card">
          <h3>Palabras dadas (frecuencia)</h3>
          <ul class="freq-list">
            <li v-for="(it, idx) in topGiven" :key="idx">
              <div class="row">
                <span class="term">{{ it.term }}</span>
                <span class="count">{{ it.count }}</span>
              </div>
              <div class="bar">
                <div class="fill" :style="{ width: barWidth(it.count, maxGiven) }"></div>
              </div>
            </li>
          </ul>
        </div>

        <div class="card">
          <h3>Palabras descubiertas (frecuencia)</h3>
          <ul class="freq-list">
            <li v-for="(it, idx) in topDiscovered" :key="idx">
              <div class="row">
                <span class="term">{{ it.term }}</span>
                <span class="count">{{ it.count }}</span>
              </div>
              <div class="bar">
                <div class="fill alt" :style="{ width: barWidth(it.count, maxDiscovered) }"></div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="placeholder">Presione "Ejecutar análisis" para obtener resultados</div>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { apiFetch } from '../lib/api'
import { appStore } from '../lib/store'

const loading = ref(false)
const error = ref('')

// Resultado persistente en store
const result = ref(appStore.keywordAnalysis || null)
watchEffect(() => {
  appStore.keywordAnalysis = result.value
})

async function runAnalysis() {
  loading.value = true
  error.value = ''
  try {
    const resp = await apiFetch('/api/algoritmos/keyword-analysis', { method: 'GET' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    let json
    try {
      json = await resp.json()
    } catch (e) {
      const text = await resp.text()
      json = JSON.parse(text)
    }
    result.value = json
  } catch (e) {
    error.value = `Error al ejecutar análisis: ${e.message}`
  } finally {
    loading.value = false
  }
}

// Derivados para top N
const TOP = 15
const topGiven = computed(() => (result.value?.givenKeywordFrequencies || []).slice(0, TOP))
const topDiscovered = computed(() => (result.value?.discoveredKeywords || []).slice(0, TOP))
const maxGiven = computed(() => Math.max(1, ...topGiven.value.map(i => i.count)))
const maxDiscovered = computed(() => Math.max(1, ...topDiscovered.value.map(i => i.count)))

function barWidth(count, max) {
  const pct = Math.round((count / max) * 100)
  return `${pct}%`
}

function formatPrecision(p) {
  if (p == null) return '-'
  return `${(Number(p) * 100).toFixed(2)}%`
}
</script>

<style scoped>
.keyword-view {
  padding: 0.5rem 0 1rem;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.btn-run {
  padding: 0.5rem 0.9rem;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #f6f8fa;
  color: #24292f;
  cursor: pointer;
}

.btn-run:disabled { opacity: 0.6; cursor: not-allowed; }

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
  padding: 0.6rem;
  border-radius: 8px;
  margin: 0.5rem 0 0.75rem;
}

.placeholder {
  text-align: center;
  color: #888;
  padding: 1rem 0;
}

.result-wrap { display: flex; flex-direction: column; gap: 1rem; }
.summary { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 0.75rem; }
.summary-main { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
.category { color: #374151; }
.precision { color: #111827; }
.precision-explanation { color: #6b7280; font-size: 0.9rem; margin-top: 0.25rem; }

.cards-two-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; }
.card { border: 1px solid #eee; border-radius: 10px; padding: 0.75rem; background: #fff; }
.card h3 { margin: 0 0 0.5rem; color: #111827; }
.freq-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.freq-list .row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.term { font-weight: 600; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { color: #6b7280; font-size: 0.9rem; }
.bar { height: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: #60a5fa; }
.fill.alt { background: #34d399; }
</style>
