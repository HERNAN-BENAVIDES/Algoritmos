<template>
  <div class="search-download">
    <div class="search-form">
      <div class="form-group">
        <label for="query">Query de búsqueda:</label>
        <input
          id="query"
          v-model="query"
          type="text"
          placeholder="Ingrese término de búsqueda..."
          :disabled="isDownloading"
          @keyup.enter="handleDownload"
        />
      </div>

      <button
        class="btn-primary"
        :disabled="!query.trim() || isDownloading"
        @click="handleDownload"
      >
        {{ isDownloading ? 'Descargando...' : 'Descargar' }}
      </button>
    </div>

    <!-- Mensajes de feedback -->
    <div v-if="errorMessage" class="message error">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="message success">
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiFetch } from '../lib/api'

const query = ref('')
const isDownloading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function handleDownload() {
  if (!query.value.trim()) {
    errorMessage.value = 'Por favor ingrese un término de búsqueda'
    return
  }

  isDownloading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch(
      `/api/algoritmos/download-articles?query=${encodeURIComponent(query.value)}`,
      {
        method: 'POST'
      }
    )

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    successMessage.value = 'Descarga completada exitosamente. Vaya a la pestaña "Artículos" para ver los resultados.'
  } catch (error) {
    errorMessage.value = `Error al descargar: ${error.message}`
  } finally {
    isDownloading.value = false
  }
}
</script>

<style scoped>
.search-download {
  width: 100%;
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.search-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: #555;
}

input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.message {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.95rem;
}

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.message.success {
  background: #efe;
  color: #363;
  border: 1px solid #cfc;
}
</style>
