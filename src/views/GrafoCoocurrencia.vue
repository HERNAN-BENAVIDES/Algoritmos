<template>
  <div class="graphs-view">
    <div class="header-row">
      <h2>Grafo de coocurrencia</h2>
    </div>

    <section class="card">
      <h3>Construcción</h3>
      <div class="row">
        <button class="primary" @click="onBuildCooccurrence" :disabled="loading.cooccurrence">
          {{ loading.cooccurrence ? 'Construyendo…' : 'Construir (R3+R4)' }}
        </button>
        <button class="secondary" @click="onBuildCooccurrenceFixed" :disabled="loading.cooccurrenceFixed">
          {{ loading.cooccurrenceFixed ? 'Construyendo…' : 'Construir (vocabulario fijo)' }}
        </button>
      </div>
      <div v-if="cooccurrenceResult" class="result">
        <details open>
          <summary>Resultado</summary>
          <pre>{{ pretty(cooccurrenceResult) }}</pre>
        </details>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { buildCooccurrence, buildCooccurrenceFixed } from '@/lib/api'

const loading = ref({
  cooccurrence: false,
  cooccurrenceFixed: false
})

const error = ref('')
const cooccurrenceResult = ref(null)

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
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

async function onBuildCooccurrence() {
  const res = await safeRun('cooccurrence', buildCooccurrence)
  if (res) cooccurrenceResult.value = res
}

async function onBuildCooccurrenceFixed() {
  const res = await safeRun('cooccurrenceFixed', buildCooccurrenceFixed)
  if (res) cooccurrenceResult.value = res
}
</script>

<style scoped>
.graphs-view { padding: 0.5rem 0 1rem; display: grid; gap: 1rem; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.25rem; }

.card { border: 1px solid #eaeaea; border-radius: 12px; padding: 0.85rem; background: #fff; }
.card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }

.row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 0.9rem; cursor: pointer; }
.secondary { background: #eef4ff; color: #0b5ed7; border: 1px solid #cfe2ff; border-radius: 8px; padding: 0.5rem 0.9rem; cursor: pointer; }
.primary:disabled, .secondary:disabled { opacity: 0.6; cursor: not-allowed; }

.result { margin-top: 0.5rem; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 0.5rem; }
.result pre { max-height: 320px; overflow: auto; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 0.5rem; }

.error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; padding: 0.5rem; border-radius: 8px; }
</style>

