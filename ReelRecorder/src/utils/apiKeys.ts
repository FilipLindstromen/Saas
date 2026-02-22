/**
 * API keys are stored centrally in the SaaS apps screen (docs/index.html).
 * All apps read from the same localStorage key: saasApiKeys.
 */
// @ts-ignore - shared module is JS
import { loadApiKeys, getApiKey } from '@shared/apiKeys'

export { loadApiKeys, getApiKey }
