<template>
  <div class="dendrograms-view">
    <div class="header-row">
      <h2>Dendrogramas</h2>
      <button class="btn-refresh" @click="refresh" :disabled="loading">
        {{ loading ? 'Cargando…' : 'Refrescar' }}
      </button>
    </div>

    <div v-if="error" class="message error">{{ error }}</div>

    <div v-if="bestInfo" class="message info">
      Mejor coherencia (CCC): <strong>{{ bestInfo.bestLabel }}</strong>
      <span class="ccc">| single: {{ fmt(ccc.single) }} | complete: {{ fmt(ccc.complete) }} | average: {{ fmt(ccc.average) }}</span>
    </div>

    <div v-if="dendrogramas.length > 0" class="list">
      <div class="item" v-for="dendro in dendrogramas" :key="dendro.tipo">
        <h3 class="item-title">{{ dendro.titulo }}</h3>
        <div class="image-row">
          <!-- Vista principal: tal cual llega del back (sin rotación) -->
          <img
              :src="dendro.dataUri"
              :alt="dendro.titulo"
              class="dendro-image clickable"
              @error="handleImageError(dendro)"
              @click="openRotatedTab(dendro)"
          />
          <div class="hint">Click para abrir en nueva pestaña con rotación</div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="placeholder">
      Presione "Refrescar" para cargar los dendrogramas.
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchDendrogramas } from '../lib/api'

const loading = ref(false)
const error = ref('')

const dendrogramas = ref([]) // [{ titulo, dataUri, tipo }]
const ccc = ref({ single: null, complete: null, average: null })
const best = ref(null)

const titlesByType = {
  average: 'Dendrograma Average Linkage',
  complete: 'Dendrograma Complete Linkage',
  single: 'Dendrograma Single Linkage'
}

const bestInfo = computed(() => {
  if (!best.value) return null
  const map = { single: 'Single', complete: 'Complete', average: 'Average' }
  return { bestLabel: map[best.value] || best.value }
})

function fmt(v) {
  return v == null ? '—' : Number(v).toFixed(3)
}

async function refresh() {
  loading.value = true
  error.value = ''
  dendrogramas.value = []
  ccc.value = { single: null, complete: null, average: null }
  best.value = null

  try {
    const data = await fetchDendrogramas()

    // Esperado: data.images.{single,complete,average}.dataUri (data:image/png;base64,...)
    const images = data?.images || {}
    const miss = []
    ;['average','complete','single'].forEach(k => { if (!images[k]?.dataUri) miss.push(k) })
    if (miss.length) error.value = `Faltan imágenes en la respuesta: ${miss.join(', ')}`

    const make = (type) => images[type]?.dataUri
        ? ({ titulo: titlesByType[type], dataUri: images[type].dataUri, tipo: type })
        : null

    dendrogramas.value = ['average','complete','single'].map(make).filter(Boolean)

    // Métricas opcionales
    const cophen = data?.metrics?.cophenetic || {}
    ccc.value = {
      single: cophen.single ?? null,
      complete: cophen.complete ?? null,
      average: cophen.average ?? null
    }
    best.value = data?.metrics?.best ?? null

  } catch (e) {
    error.value = `Error al cargar dendrogramas: ${e?.message || e}`
    console.error('Error /api/algoritmos/dendrograma:', e)
  } finally {
    loading.value = false
  }
}

function handleImageError(dendro) {
  console.warn('No se pudo mostrar la imagen del dendrograma:', dendro?.tipo)
  // Si viniera base64 crudo por error, intenta auto-corregir:
  if (dendro?.dataUri && !dendro.dataUri.startsWith('data:image/')) {
    dendro.dataUri = `data:image/png;base64,${dendro.dataUri}`
  }
}

/**
 * Abre una NUEVA PESTAÑA con la imagen rotada -90° y adaptada al viewport.
 * Implementación: se genera un HTML mínimo en un Blob y se abre con target=_blank.
 */
function openRotatedTab(dendro) {
  if (!dendro?.dataUri) return

  const title = (dendro.titulo || 'Dendrograma') + ' — Vista rotada'
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji';
    background: #0b0c0d;
    color: #e5e7eb;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  header {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .5rem .75rem;
    background: #111827;
    border-bottom: 1px solid #1f2937;
  }
  header h1 { font-size: 1rem; margin: 0; font-weight: 600; }
  header .spacer { flex: 1; }
  header a.btn {
    border: 1px solid #374151;
    background: #1f2937;
    color: #e5e7eb;
    border-radius: 8px;
    padding: .35rem .6rem;
    text-decoration: none;
  }
  header a.btn:hover { background: #2a3443; }
  main { position: relative; overflow: auto; }
  .stage {
    min-height: 100%;
    min-width: 100%;
    display: grid;
    place-items: center;
    padding: 12px;
  }
  img.rotated {
    transform: rotate(-90deg);
    transform-origin: center center;
    max-width: none;
    max-height: none;
  }
  .fit { width: min(90svh, 1600px); height: auto; }
  footer {
    position: fixed;
    right: .75rem; bottom: .75rem;
    opacity: .8;
    font-size: .8rem;
  }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(dendro.titulo || 'Dendrograma')}</h1>
    <div class="spacer"></div>
    <a class="btn" download="${escapeAttr((dendro.titulo || 'dendrograma') + '.png')}" href="${escapeAttr(dendro.dataUri)}">Descargar PNG</a>
  </header>
  <main>
    <div class="stage">
      <img class="rotated fit" src="${escapeAttr(dendro.dataUri)}" alt="${escapeAttr(dendro.titulo || 'Dendrograma rotado')}">
    </div>
  </main>
  <footer>Rotado -90° para mejor lectura horizontal</footer>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // Forzamos nueva pestaña con un <a target="_blank">
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener' // seguridad
  // nombre de pestaña opcional (no todos los navegadores lo usan)
  a.click()

  // Revocar el blob URL cuando el foco vuelva (previene fugas)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Utilidades pequeñas para evitar inyección en el HTML dinámico
function escapeHtml(s='') {
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
}
function escapeAttr(s='') {
  return String(s).replace(/["<>&]/g, c => ({'"':'&quot;','<':'&lt;','>':'&gt;','&':'&amp;'}[c]))
}
</script>

<style scoped>
.dendrograms-view { padding: 0.5rem 0 1rem; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
.btn-refresh { padding: 0.45rem 0.8rem; border: 1px solid #d0d7de; border-radius: 8px; background: #f6f8fa; color: #24292f; cursor: pointer; }
.btn-refresh:hover { background: #e9ecef; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

.placeholder { text-align: center; color: #888; padding: 1rem 0; }
.message.error { background: #fee; color: #c33; border: 1px solid #fcc; padding: 0.6rem; border-radius: 8px; margin: 0.5rem 0 0.75rem; }
.message.info { background: #eef7ff; color: #164e7a; border: 1px solid #b8dcff; padding: 0.6rem; border-radius: 8px; margin: 0.5rem 0 0.75rem; }
.message.info .ccc { margin-left: 0.5rem; color: #40627d; }

.list { display: flex; flex-direction: column; gap: 1rem; }
.item { border: 1px solid #eee; border-radius: 10px; padding: 0.75rem; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.item-title { margin: 0 0 0.5rem; color: #111827; font-size: 1.1rem; }

.image-row {
  width: 100%;
  overflow: auto; /* deja scroll si la imagen es más alta que el contenedor */
  background: #f9fafb;
  border-radius: 8px;
  padding: 0.5rem;
  display: grid;
  place-items: center;
  height: clamp(420px, 75vh, 900px);
}

/* Mostrar la imagen TAL CUAL llega del back (sin rotación ni JS) */
.dendro-image {
  display: block;
  max-width: 100%;
  height: auto;
  image-rendering: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-radius: 4px;
}
.dendro-image.clickable { cursor: zoom-in; }

.image-row .hint {
  margin-top: .35rem;
  font-size: .8rem;
  color: #6b7280;
}

@media (max-width: 640px) {
  .image-row { height: clamp(320px, 60vh, 600px); }
}
</style>
