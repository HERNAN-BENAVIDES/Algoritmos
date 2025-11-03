<template>
  <div class="dendrograms-view">
    <div class="header-row">
      <h2>Dendrogramas</h2>
      <button class="btn-refresh" @click="refresh" :disabled="loading">
        {{ loading ? 'Cargando…' : 'Refrescar' }}
      </button>
    </div>

    <div v-if="error" class="message error">{{ error }}</div>

    <div v-if="dendrogramas.length > 0" class="list">
      <div class="item" v-for="(dendro, index) in dendrogramas" :key="index">
        <h3 class="item-title">{{ dendro.titulo }}</h3>
        <div class="image-row" :ref="el => containerRefs[index] = el">
          <a :href="dendro.imageUrl" target="_blank" rel="noopener noreferrer" title="Abrir en una nueva pestaña">
            <img
              :src="dendro.imageUrl"
              :alt="dendro.titulo"
              class="dendro-image rotate-left"
              :ref="el => imgRefs[index] = el"
              @load="handleImageLoad(index)"
              @error="handleImageError(index)"
            />
          </a>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="placeholder">
      Presione "Refrescar" para cargar los dendrogramas.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { listLocalDendrogramImages, triggerDendrogramGeneration } from '../lib/api'

const loading = ref(false)
const error = ref('')

const dendrogramas = ref([])

const imgRefs = ref([])
const containerRefs = ref([])

const titlesByType = {
  average: 'Dendrograma Average Linkage',
  complete: 'Dendrograma Complete Linkage',
  single: 'Dendrograma Single Linkage'
}

async function refresh() {
  loading.value = true
  error.value = ''
  dendrogramas.value = []
  imgRefs.value = []
  containerRefs.value = []

  try {
    await triggerDendrogramGeneration()
    await new Promise(r => setTimeout(r, 10000))

    const start = Date.now()
    const timeoutMs = 30_000
    let latest = null

    while (Date.now() - start < timeoutMs) {
      try {
        latest = await listLocalDendrogramImages()
        if (latest?.average && latest?.complete && latest?.single) break
      } catch {}
      await new Promise(r => setTimeout(r, 800))
    }

    if (!latest) {
      error.value = 'No se pudo obtener el listado de imágenes locales'
      return
    }

    const missing = []
    if (!latest.average) missing.push('average')
    if (!latest.complete) missing.push('complete')
    if (!latest.single) missing.push('single')
    if (missing.length) {
      error.value = `Imágenes no encontradas: ${missing.join(', ')}`
    }

    const ts = Date.now()
    const make = (entry, type) => entry ? ({
      titulo: titlesByType[type],
      imageUrl: `${entry.url}?t=${ts}`,
      tipo: type,
      filename: entry.filename,
    }) : null

    dendrogramas.value = [
      make(latest.average, 'average'),
      make(latest.complete, 'complete'),
      make(latest.single, 'single'),
    ].filter(Boolean)

    await nextTick()
    // Intentar ajustar en caso de que alguna ya esté cacheada (y no dispare load)
    imgRefs.value.forEach((_, i) => fitImageToContainer(i))

  } catch (e) {
    error.value = `Error al cargar dendrogramas: ${e?.message || e}`
    console.error('Error cargando dendrogramas:', e)
  } finally {
    loading.value = false
  }
}

function handleImageLoad(index) {
  fitImageToContainer(index)
}

function fitImageToContainer(index) {
  const img = imgRefs.value[index]
  const box = containerRefs.value[index]
  if (!img || !box) return
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const cw = box.clientWidth
  const ch = box.clientHeight
  if (!iw || !ih || !cw || !ch) return
  // Tras rotación 90°, el tamaño efectivo se invierte: ancho=ih, alto=iw
  const scale = Math.min(cw / ih, ch / iw)
  img.style.transform = `rotate(-90deg) scale(${scale})`
  img.style.transformOrigin = 'center center'
}

async function handleImageError(index) {
  const item = dendrogramas.value[index]
  if (!item) return
  console.warn(`Fallo al cargar ${item.filename}. Reintentando…`)
  await new Promise(r => setTimeout(r, 700))
  const bust = Date.now()
  dendrogramas.value[index] = { ...item, imageUrl: `${item.imageUrl.split('?')[0]}?t=${bust}` }
}

function handleResize() {
  // Recalcular escalado en redimensionamiento de ventana
  imgRefs.value.forEach((_, i) => fitImageToContainer(i))
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.dendrograms-view { padding: 0.5rem 0 1rem; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
.btn-refresh { padding: 0.45rem 0.8rem; border: 1px solid #d0d7de; border-radius: 8px; background: #f6f8fa; color: #24292f; cursor: pointer; }
.btn-refresh:hover { background: #e9ecef; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.placeholder { text-align: center; color: #888; padding: 1rem 0; }
.message.error { background: #fee; color: #c33; border: 1px solid #fcc; padding: 0.6rem; border-radius: 8px; margin: 0.5rem 0 0.75rem; }

/* Lista vertical */
.list { display: flex; flex-direction: column; gap: 1rem; }
.item { border: 1px solid #eee; border-radius: 10px; padding: 0.75rem; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.item-title { margin: 0 0 0.5rem; color: #111827; font-size: 1.1rem; }

/* Contenedor sin scroll; ajusta imagen dentro */
.image-row {
  width: 100%;
  overflow: hidden; /* no scroll */
  background: #f9fafb;
  border-radius: 8px;
  padding: 0.5rem;
  display: grid;
  place-items: center; /* centrar imagen */
  /* Altura adaptable */
  height: clamp(420px, 75vh, 900px);
}

/* Imagen rotada; tamaño controlado por transform scale calculado en JS */
.dendro-image { display: block; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; }
.rotate-left {
  transform: rotate(-90deg);
  transform-origin: center center;
  /* width/height sin fijar; el ajuste lo hace fitImageToContainer() con scale() */
}

@media (max-width: 640px) {
  .image-row { height: clamp(320px, 60vh, 600px); }
}
</style>
