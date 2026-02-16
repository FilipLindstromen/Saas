export async function generateWithOpenAI(
  apiKey: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk?: (text: string) => void
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error: ${response.status}`);
  }

  if (onChunk && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
    return full;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
