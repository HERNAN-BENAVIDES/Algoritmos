<template>
  <div class="wordcloud-view">
    <div class="header-row">
      <h2>Nube de palabras (abstracts + keywords)</h2>
      <form class="options" @submit.prevent="reload">
        <label class="field">
          Límite
          <input v-model.number="limit" type="number" min="1" step="1" placeholder="Ej: 100" />
        </label>
        <button class="primary" type="submit" :disabled="loading">{{ loading ? 'Cargando…' : 'Actualizar' }}</button>
      </form>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="cloud-wrapper" :class="{ loading: loading }">
      <div v-if="loading" class="loading-overlay">Generando nube…</div>
      <div v-else class="cloud" ref="cloudEl">
        <span
          v-for="t in words"
          :key="t.term"
          class="wc-word"
          :style="styleFor(t)"
          @click="selectWord(t)"
          :title="`${t.term} (${t.frequency})`"
        >{{ t.term }}</span>
      </div>
    </div>

    <div v-if="words.length" class="stats">
      <div><strong>Palabras:</strong> {{ words.length }}</div>
      <div><strong>Frecuencia total:</strong> {{ totalFrequency }}</div>
      <div v-if="selected"><strong>Seleccionada:</strong> {{ selected.term }} ({{ selected.frequency }})</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { wordCloud } from '@/lib/api'

// Normaliza distintos formatos de respuesta a [{term, frequency}]
function normalizeWordCloudData(raw) {
  let arr = raw
  if (!Array.isArray(arr)) {
    if (raw && Array.isArray(raw.data)) arr = raw.data
    else if (raw && Array.isArray(raw.items)) arr = raw.items
    else if (raw && Array.isArray(raw.words)) arr = raw.words
    else if (raw && Array.isArray(raw.result)) arr = raw.result
    else if (raw && Array.isArray(raw.content)) arr = raw.content
  }
  if (!Array.isArray(arr)) return []
  return arr.map((it) => ({
    term: it.term ?? it.key ?? it.word ?? String(it?.term ?? it?.key ?? ''),
    frequency: Number(it.frequency ?? it.value ?? it.count ?? 0)
  })).filter(x => x.term && Number.isFinite(x.frequency))
}

const limit = ref(100)
const loading = ref(false)
const error = ref('')
const words = ref([])
const selected = ref(null)
const cloudEl = ref(null)

const totalFrequency = computed(() => words.value.reduce((acc, w) => acc + (w.frequency || 0), 0))

function scaleFrequency(freq, minF, maxF) {
  // Escalar tamaño entre 0.75rem y 3.2rem
  const minSize = 0.75
  const maxSize = 3.2
  if (maxF === minF) return `${minSize}rem`
  const ratio = (freq - minF) / (maxF - minF)
  const size = minSize + ratio * (maxSize - minSize)
  return `${size.toFixed(2)}rem`
}

function styleFor(termObj) {
  const freqs = words.value.map(w => w.frequency)
  const minF = Math.min(...freqs)
  const maxF = Math.max(...freqs)
  const fontSize = scaleFrequency(termObj.frequency, minF, maxF)
  // Color dinámico usando HSL: más frecuencia => tono más profundo
  const ratio = maxF === minF ? 0.5 : (termObj.frequency - minF) / (maxF - minF)
  const hue = 210 // azul
  const sat = 60 + ratio * 25
  const light = 30 + (1 - ratio) * 35
  return {
    fontSize,
    color: `hsl(${hue} ${sat}% ${light}%)`,
    '--rot': `${(Math.random() * 6 - 3).toFixed(2)}deg`
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

async function reload() {
  loading.value = true
  error.value = ''
  selected.value = null
  try {
    const data = await wordCloud(limit.value)
    const normalized = normalizeWordCloudData(data)
    if (normalized.length) {
      const sorted = [...normalized].sort((a, b) => b.frequency - a.frequency)
      words.value = shuffle(sorted)
    } else {
      words.value = []
      console.warn('[WordCloud] Respuesta vacía o no válida:', data)
    }
  } catch (e) {
    console.error('[WordCloud] Error cargando nube:', e)
    error.value = e.message || 'Error cargando nube'
  } finally {
    loading.value = false
  }
}

function selectWord(w) {
  selected.value = w
}

onMounted(reload)

watch(limit, (val, old) => {
  if (val !== old && val > 0) reload()
})
</script>

<style scoped>
.wordcloud-view { display: grid; gap: 1rem; }
.header-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .75rem; }
.options { display: flex; flex-wrap: wrap; gap: .75rem; align-items: flex-end; }
.field { display: grid; gap: .25rem; }
.field input { padding: .45rem .6rem; border: 1px solid #d0d7de; border-radius: 8px; }
.primary { background: #0b5ed7; color: #fff; border: none; border-radius: 8px; padding: .55rem .95rem; cursor: pointer; }
.primary:disabled { opacity: .6; cursor: not-allowed; }
.error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; padding: .5rem .75rem; border-radius: 8px; }
.cloud-wrapper { position: relative; min-height: 420px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: .75rem; overflow: hidden; }
.cloud-wrapper.loading { opacity: 0.75; }
.loading-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #0b5ed7; background: linear-gradient(135deg,#ffffff 0%,#f3f8ff 60%); }
.cloud { width: 100%; height: 100%; display: flex; flex-wrap: wrap; align-content: flex-start; gap: .35rem .5rem; }
.wc-word { --rot: 0deg; line-height: 1; font-weight: 600; display: inline-block; padding: .15rem .25rem; cursor: pointer; transition: transform .15s ease, filter .15s ease; transform: rotate(var(--rot)); }
.wc-word:hover { transform: rotate(var(--rot)) scale(1.12); filter: brightness(1.15); }
.wc-word:active { transform: rotate(var(--rot)) scale(1.05); }
.stats { display: flex; flex-wrap: wrap; gap: 1rem; font-size: .9rem; background: #f8fafc; border: 1px solid #e5e7eb; padding: .6rem .8rem; border-radius: 10px; }
</style>
