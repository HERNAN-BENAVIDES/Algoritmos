// Sencillo store reactivo global para tabs y resultados de análisis
import { reactive, watch } from 'vue'

function loadInitial() {
  try {
    const raw = sessionStorage.getItem('appStore')
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

const init = loadInitial()

export const appStore = reactive({
  activeTab: init.activeTab ?? 'search',
  // Estructura: {
  //   raw: Array<AlgorithmGroup>,
  //   selectedArticlesMap: Record<string, Article>
  // }
  lastAnalysis: init.lastAnalysis ?? null,
  // Lista de artículos cargados en "Artículos"
  articles: init.articles ?? [],
  // Selección de IDs de artículos (array simple para fácil serialización)
  selectedArticleIds: init.selectedArticleIds ?? []
})

export function setActiveTab(tabId) {
  appStore.activeTab = tabId
}

watch(
  appStore,
  (val) => {
    try {
      const toSave = {
        activeTab: val.activeTab,
        lastAnalysis: val.lastAnalysis,
        articles: val.articles,
        selectedArticleIds: val.selectedArticleIds
      }
      sessionStorage.setItem('appStore', JSON.stringify(toSave))
    } catch {
      // Silenciar errores de almacenamiento (p. ej., storage lleno o bloqueado)
    }
  },
  { deep: true }
)
