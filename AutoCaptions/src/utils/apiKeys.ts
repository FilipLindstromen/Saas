// @ts-ignore - shared module is JS
import { loadApiKeys as loadShared } from '@shared/apiKeys'

export function loadApiKeys(): { openai: string } {
  const keys = loadShared()
  return { openai: keys.openai ?? '' }
}
