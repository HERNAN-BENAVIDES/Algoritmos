<template>
  <div class="articles-view">
    <h2>Artículos</h2>

    <!-- Barra de acciones -->
    <div class="actions-bar">
      <button class="btn-primary" @click="loadArticles" :disabled="isLoadingArticles">
        {{ isLoadingArticles ? 'Cargando...' : 'Cargar artículos' }}
      </button>

      <input
        v-model="filterText"
        type="text"
        placeholder="Filtrar por título o autor..."
        class="filter-input"
      />

      <div class="selection-actions">
        <button class="btn-secondary" @click="selectAll" :disabled="!articles.length">
          Seleccionar todo
        </button>
        <button class="btn-secondary" @click="clearSelection" :disabled="!selectedIds.size">
          Limpiar selección
        </button>
      </div>

      <button
        class="btn-analyze"
        @click="analyzeSimilarity"
        :disabled="selectedIds.size < 2 || isAnalyzing"
      >
        {{ isAnalyzing ? 'Analizando...' : `Analizar similitud (${selectedIds.size})` }}
      </button>
    </div>

    <!-- Mensajes -->
    <div v-if="errorMessage" class="message error">
      {{ errorMessage }}
    </div>

    <!-- Tabla de artículos -->
    <div v-if="filteredArticles.length" class="table-container">
      <table class="articles-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                :checked="allFilteredSelected"
                @change="toggleAllFiltered"
              />
            </th>
            <th>Título</th>
            <th>Autores</th>
            <th>Año</th>
            <th>Páginas</th>
            <th>Keywords</th>
            <th>Abstract</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="article in filteredArticles" :key="article.id">
            <td>
              <input
                type="checkbox"
                :checked="selectedIds.has(article.id)"
                @change="toggleSelection(article.id)"
              />
            </td>
            <td class="title-cell">{{ article.title }}</td>
            <td>{{ article.authors.join(', ') }}</td>
            <td>{{ article.year || '-' }}</td>
            <td>{{ article.pages || '-' }}</td>
            <td class="keywords-cell">{{ article.keywords.join(', ') }}</td>
            <td class="abstract-cell" :title="article.abstractText">
              {{ truncateAbstract(article.abstractText) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!isLoadingArticles" class="no-data">
      No hay artículos cargados. Presione "Cargar artículos" para obtenerlos.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect, nextTick } from 'vue'
import { apiFetch } from '../lib/api'
import { appStore, setActiveTab } from '../lib/store'

// Artículos y selección provienen del store para persistir entre tabs
const articles = ref(appStore.articles || [])
const selectedIds = ref(new Set(appStore.selectedArticleIds || []))

// Mantener sincronizados con el store (serializando Set a array)
watchEffect(() => {
  appStore.articles = articles.value
  appStore.selectedArticleIds = Array.from(selectedIds.value)
})

const filterText = ref('')
const isLoadingArticles = ref(false)
const isAnalyzing = ref(false)
const errorMessage = ref('')

const filteredArticles = computed(() => {
  if (!filterText.value.trim()) return articles.value
  
  const search = filterText.value.toLowerCase()
  return articles.value.filter(article => 
    article.title.toLowerCase().includes(search) ||
    article.authors.some(author => author.toLowerCase().includes(search))
  )
})

const allFilteredSelected = computed(() => {
  if (!filteredArticles.value.length) return false
  return filteredArticles.value.every(a => selectedIds.value.has(a.id))
})

async function loadArticles() {
  isLoadingArticles.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch(
        '/api/algoritmos/get-articles',
        {
          method: 'GET'
        }
    )

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    const data = await response.json()
    articles.value = data
    selectedIds.value.clear()
    selectedIds.value = new Set(selectedIds.value)
  } catch (error) {
    errorMessage.value = `Error al cargar artículos: ${error.message}`
  } finally {
    isLoadingArticles.value = false
  }
}

function toggleSelection(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  // Forzar actualización reactiva
  selectedIds.value = new Set(selectedIds.value)
}

function selectAll() {
  filteredArticles.value.forEach(article => {
    selectedIds.value.add(article.id)
  })
  selectedIds.value = new Set(selectedIds.value)
}

function clearSelection() {
  selectedIds.value.clear()
  selectedIds.value = new Set(selectedIds.value)
}

function toggleAllFiltered() {
  if (allFilteredSelected.value) {
    filteredArticles.value.forEach(article => {
      selectedIds.value.delete(article.id)
    })
  } else {
    filteredArticles.value.forEach(article => {
      selectedIds.value.add(article.id)
    })
  }
  selectedIds.value = new Set(selectedIds.value)
}

async function analyzeSimilarity() {
  if (selectedIds.value.size < 2) {
    errorMessage.value = 'Debe seleccionar al menos 2 artículos'
    return
  }

  isAnalyzing.value = true
  errorMessage.value = ''

  try {
    const selectedArticles = articles.value.filter(a => selectedIds.value.has(a.id))

    const response = await apiFetch('/api/algoritmos/similarity-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(selectedArticles)
    })

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    // El backend retorna JSON; lo parseamos de forma robusta
    let raw
    try {
      raw = await response.json()
    } catch (e) {
      const text = await response.text()
      raw = JSON.parse(text)
    }

    const selectedArticlesMap = Object.fromEntries(
      selectedArticles.map(a => [a.id, a])
    )

    appStore.lastAnalysis = { raw, selectedArticlesMap }
    setActiveTab('results')
    if (appStore.activeTab !== 'results') {
      appStore.activeTab = 'results'
    }
    await nextTick()
  } catch (error) {
    errorMessage.value = `Error al analizar: ${error.message}`
  } finally {
    isAnalyzing.value = false
  }
}

function truncateAbstract(text) {
  if (!text) return '-'
  return text.length > 180 ? text.substring(0, 180) + '…' : text
}
</script>

<style scoped>
.articles-view {
  padding: 1rem 0;
}

h2 {
  color: #333;
  margin-bottom: 1rem;
}

.actions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
}

.filter-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.selection-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary,
.btn-secondary,
.btn-analyze {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4a90e2;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-secondary {
  background: #f5f5f5;
  color: #555;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #e8e8e8;
}

.btn-analyze {
  background: #27ae60;
  color: white;
}

.btn-analyze:hover:not(:disabled) {
  background: #229954;
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-analyze:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  margin: 1rem 0;
  padding: 0.75rem;
  border-radius: 4px;
}

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.table-container {
  overflow-x: auto;
  margin: 1rem 0;
}

.articles-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.articles-table th,
.articles-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.articles-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #555;
  position: sticky;
  top: 0;
}

.articles-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.articles-table tbody tr:hover {
  background: #f0f7ff;
}

.title-cell {
  font-weight: 500;
  max-width: 300px;
}

.keywords-cell,
.abstract-cell {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.abstract-cell {
  color: #666;
  font-size: 0.85rem;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #999;
}
</style>
