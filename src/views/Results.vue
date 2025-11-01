<template>
  <div class="results-view">
    <h2>Resultados</h2>

    <div v-if="!appStore.lastAnalysis" class="empty">
      Aún no hay resultados. Vuelva a "Artículos" y ejecute un análisis.
    </div>

    <div v-else class="algorithms-list">
      <div
        v-for="group in appStore.lastAnalysis.raw"
        :key="group.algorithm"
        class="algo-group"
      >
        <div class="algo-header">
          <h3>{{ group.algorithm }}</h3>
          <div class="algo-meta">
            <span class="badge">Comparaciones: {{ group.totalComparisons }}</span>
            <span class="badge">Tiempo total: {{ group.totalTimeMs }} ms</span>
          </div>
        </div>

        <div class="cards-grid">
          <div v-for="(r, idx) in group.results" :key="idx" class="result-card">
            <div class="articles">
              <div class="article">
                <div class="article-title" :title="r.idA">
                  {{ titleFor(r.idA) }}
                </div>
                <div class="article-id">{{ r.idA }}</div>
              </div>
              <div class="vs">⇄</div>
              <div class="article">
                <div class="article-title" :title="r.idB">
                  {{ titleFor(r.idB) }}
                </div>
                <div class="article-id">{{ r.idB }}</div>
              </div>
            </div>

            <div class="metrics">
              <div class="metric">
                <span class="label">Similaridad</span>
                <span class="value">{{ formatPercent(r.similarityPercent) }}</span>
              </div>
              <div class="metric">
                <span class="label">Score</span>
                <span class="value">{{ formatNumber(r.score) }}</span>
              </div>
              <div class="metric">
                <span class="label">Tiempo</span>
                <span class="value">{{ r.timeMs }} ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { appStore } from '../lib/store'

function titleFor(id) {
  const a = appStore.lastAnalysis?.selectedArticlesMap?.[id]
  return a?.title || '(título no disponible)'
}

function formatPercent(p) {
  if (p == null) return '-'
  return `${Number(p).toFixed(2)}%`
}

function formatNumber(n) {
  if (n == null) return '-'
  return Number(n).toFixed(3)
}
</script>

<style scoped>
.results-view {
  padding: 0.5rem 0 1rem;
}

h2 {
  color: #333;
  margin-bottom: 1rem;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #888;
  background: #fafafa;
  border: 1px dashed #ddd;
  border-radius: 8px;
}

.algorithms-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.algo-group {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 1rem;
}

.algo-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
}

.algo-header h3 {
  margin: 0;
  color: #222;
}

.algo-meta {
  display: flex;
  gap: 0.5rem;
}

.badge {
  background: #f5f5f5;
  border: 1px solid #e6e6e6;
  color: #555;
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.result-card {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 0.75rem;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}

.articles {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
}

.article {
  min-width: 0;
}

.article-title {
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-id {
  font-size: 0.8rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vs {
  padding: 0 0.25rem;
  color: #888;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.metric {
  background: #f9fafb;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
}

.metric .label {
  display: block;
  color: #6b7280;
  font-size: 0.75rem;
  margin-bottom: 0.2rem;
}

.metric .value {
  font-weight: 700;
  color: #111827;
}
</style>
