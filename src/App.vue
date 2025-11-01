/* App.vue */

<script setup>
import { computed, watch } from 'vue'
import SearchDownload from './views/SearchDownload.vue'
import Articles from './views/Articles.vue'
import Results from './views/Results.vue'
import Settings from './views/Settings.vue'
import { appStore, setActiveTab } from './lib/store'

const tabs = [
  { id: 'search', label: 'Buscar/Descargar' },
  { id: 'articles', label: 'Artículos' },
  { id: 'results', label: 'Resultados' },
  { id: 'settings', label: 'Ajustes' }
]

const currentView = computed(() => {
  const views = {
    search: SearchDownload,
    articles: Articles,
    results: Results,
    settings: Settings
  }
  return views[appStore.activeTab]
})

// Si llegan resultados nuevos, saltar automáticamente a la pestaña de "Resultados"
watch(
  () => appStore.lastAnalysis,
  (val) => {
    if (val && appStore.activeTab !== 'results') {
      setActiveTab('results')
    }
  }
)
</script>

<template>
  <div class="app-root">
    <!-- Header a lo ancho, con contenido centrado -->
    <header class="app-header">
      <div class="header-inner">
        <h1 class="main-title">
          <span class="book-icon">📖</span>
          Análisis Bibliométrico
        </h1>

        <nav class="tabs-nav" aria-label="Secciones">
          <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab-btn', { active: appStore.activeTab === tab.id }]"
              @click="setActiveTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>
    </header>

    <!-- Contenido principal centrado -->
    <main class="main-area" role="main">
      <div class="content-wrap">
        <keep-alive>
          <component :is="currentView" />
        </keep-alive>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ===== Base ===== */
*,
*::before,
*::after { box-sizing: border-box; }

:root {
  --bg: #fafafa;
  --card: #ffffff;
  --border: #eaeaea;
  --shadow: 0 4px 16px rgba(0,0,0,0.06);
  --radius: 12px;
  --accent: #0b5ed7;
}

html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ===== Header ===== */
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}

/* Header centrado con ancho máximo */
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.main-title {
  margin: 0;
  color: #333;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 800;
  font-size: clamp(1.25rem, 2.2vw, 1.9rem);
  line-height: 1.2;
}

.book-icon { font-size: 1.5em; }

/* Tabs centrados */
.tabs-nav {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem 0.25rem 0.9rem;
}

.tab-btn {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #555;
  background: #fff;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  background: #f6f6f6;
  color: #333;
  transform: translateY(-1px);
}

.tab-btn.active {
  background: #eaf2ff;
  color: var(--accent);
  border-color: #cfe2ff;
  box-shadow: 0 1px 4px rgba(11,94,215,0.15);
}

/* ===== Main / Contenido ===== */
.main-area {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1.5rem 1rem 2rem;
}

/* Contenedor principal centrado */
.content-wrap {
  width: 100%;
  max-width: min(1200px, 100%);
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1rem, 2vw, 1.5rem);
}

/* ===== Ajustes responsivos ===== */
@media (max-width: 768px) {
  .header-inner {
    padding: 1rem 1rem 0.75rem;
  }

  .main-area {
    padding: 1rem 0.75rem 1.5rem;
  }

  .content-wrap {
    padding: 0.85rem;
  }
}

@media (max-width: 420px) {
  .tab-btn {
    padding: 0.45rem 0.85rem;
    font-size: 0.9rem;
  }

  .header-inner {
    padding: 0.75rem 0.75rem 0.5rem;
  }

  .main-area {
    padding: 0.75rem 0.5rem 1rem;
  }

  .content-wrap {
    padding: 0.75rem;
  }
}
</style>