import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import fs from 'node:fs/promises'
import path from 'node:path'

const DENDRO_DIR = '/home/hernan-dario/IdeaProjects/proyectoAlgoritmos/src/main/resources/data/dendrogramas'

async function readFileWithRetries(full, tries = 5, waitMs = 200) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await fs.readFile(full)
    } catch (e) {
      lastErr = e
      if (i < tries - 1) {
        await new Promise(r => setTimeout(r, waitMs))
      }
    }
  }
  throw lastErr
}

function localDendrogramsPlugin() {
  return {
    name: 'local-dendrograms-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next()

          // Usar URL para separar pathname y query
          const u = new URL(req.url, 'http://local')
          const pathname = u.pathname

          if (pathname === '/_local/dendrogramas') {
            let entries = []
            try {
              entries = await fs.readdir(DENDRO_DIR, { withFileTypes: true })
            } catch (e) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ average: null, complete: null, single: null, error: 'DIRECTORY_NOT_FOUND' }))
              return
            }

            const regex = /^dendro_(average|complete|single)_.*\.png$/
            const candidates = []
            for (const ent of entries) {
              if (ent.isFile() && regex.test(ent.name)) {
                const full = path.join(DENDRO_DIR, ent.name)
                try {
                  const st = await fs.stat(full)
                  candidates.push({ name: ent.name, full, mtime: st.mtimeMs })
                } catch {}
              }
            }

            const latestByType = { average: null, complete: null, single: null }
            for (const typ of ['average', 'complete', 'single']) {
              const best = candidates
                .filter(c => c.name.startsWith(`dendro_${typ}_`))
                .sort((a, b) => b.mtime - a.mtime)[0]
              if (best) {
                latestByType[typ] = {
                  filename: best.name,
                  mtime: best.mtime,
                  url: `/_local/dendrogramas/img/${encodeURIComponent(best.name)}`
                }
              }
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(latestByType))
            return
          }

          const prefix = '/_local/dendrogramas/img/'
          if (pathname.startsWith(prefix)) {
            const filename = decodeURIComponent(pathname.slice(prefix.length))
            const full = path.join(DENDRO_DIR, filename)
            try {
              const data = await readFileWithRetries(full)
              res.statusCode = 200
              res.setHeader('Content-Type', 'image/png')
              res.end(data)
              return
            } catch (e) {
              res.statusCode = 404
              res.end('Not found')
              return
            }
          }

          return next()
        } catch (err) {
          return next()
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    localDendrogramsPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
