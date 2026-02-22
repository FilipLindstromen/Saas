/**
 * Re-export shared API keys. VideoQuiz uses the same keys as other Saas apps.
 * Configure keys in Settings (gear icon) on the main app selection screen.
 */
import { loadApiKeys } from '@shared/apiKeys'

export function getApiKeys() {
  return loadApiKeys()
}
