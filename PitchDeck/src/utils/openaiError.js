/** User-facing message for failed OpenAI API responses. */
export function formatOpenAiError(status, data) {
  const code = data?.error?.code
  const message = data?.error?.message

  if (status === 401) {
    return 'Invalid OpenAI API key. Check your key in Settings.'
  }
  if (
    status === 402
    || status === 429
    || code === 'insufficient_quota'
    || code === 'billing_hard_limit_reached'
    || /quota|billing|credit|insufficient/i.test(message || '')
  ) {
    return 'OpenAI credits or quota exhausted. Add billing or check usage at platform.openai.com.'
  }
  if (status === 503 || code === 'server_error') {
    return 'OpenAI is temporarily unavailable. Please try again in a moment.'
  }

  return message || `OpenAI API error (${status || 'unknown'})`
}
