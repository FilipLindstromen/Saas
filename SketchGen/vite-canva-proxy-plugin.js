import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const rootEnv = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(rootEnv, '.env') })
dotenv.config({ path: path.join(rootEnv, '.env.local') })

const { handleCanvaTokenRequest } = require('./server/canvaTokenExchange.cjs')

export function canvaConnectProxyPlugin() {
  return {
    name: 'sketchgen-canva-proxy',
    configureServer(server) {
      server.middlewares.use('/api/canva/token', (req, res) => {
        void handleCanvaTokenRequest(req, res)
      })
    },
  }
}
