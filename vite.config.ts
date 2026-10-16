/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * One id per build, so a running tab can tell whether the deployed site has moved
 * on from the bundle it loaded (see src/services/updateWatch.ts).
 *
 * The id only has to DIFFER between deploys; nothing reads its meaning. Order of
 * preference: an explicit BUILD_ID env var, the git commit (stable across the
 * three vite processes `npm run build` runs: client, SSR, prerender), and finally
 * a timestamp for a checkout with no git, which is what the App Platform build
 * may be. The timestamp still works because the client build is one process:
 * the value baked into the bundle and the value written to version.json always
 * come from the same call.
 */
function resolveBuildId(): string {
  if (process.env.BUILD_ID) return process.env.BUILD_ID
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return Date.now().toString(36)
  }
}

const BUILD_ID = resolveBuildId()
const VERSION_FILE = 'version.json'
const versionBody = JSON.stringify({ build: BUILD_ID })

/**
 * Publishes the build id two ways: as the `__BUILD_ID__` constant the bundle is
 * compiled with (`define` below), and as /version.json next to the bundle, which
 * the deployed app polls. The file is emitted by the CLIENT build only; the SSR
 * build has no public output. The dev server answers the same URL with the same
 * id, so a local session never sees a "new version" toast and a missing file
 * never falls through to the SPA catch-all.
 */
function buildVersionPlugin(): Plugin {
  let isSsrBuild = false
  return {
    name: 'build-version',
    configResolved(config) {
      isSsrBuild = Boolean(config.build.ssr)
    },
    generateBundle() {
      if (isSsrBuild) return
      this.emitFile({ type: 'asset', fileName: VERSION_FILE, source: versionBody })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== `/${VERSION_FILE}`) return next()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(versionBody)
      })
    },
  }
}

/**
 * A shared plan's link is /plan/<id> (src/utils/appRoutes.ts sharedPlanLinkPath).
 * Deployed, an ingress rule sends it to the API, which serves the link-preview
 * page and moves people on to /app/<id>. The dev server has no such rule, so
 * without this a link copied locally would render NotFound. It skips the
 * preview (no crawler can reach localhost anyway) and goes straight to the card.
 * Dev only: the build has no server to hook.
 */
function sharedPlanLinkPlugin(): Plugin {
  return {
    name: 'shared-plan-link',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.split('?')[0].match(/^\/plan\/([A-Za-z0-9]{8})\/?$/)
        if (!match) return next()
        res.statusCode = 302
        res.setHeader('Location', `/app/${match[1]}`)
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), buildVersionPlugin(), sharedPlanLinkPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
