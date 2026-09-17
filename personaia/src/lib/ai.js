// Camada única de acesso a IA. Trocar de provedor = trocar uma string.
// Todos os providers falam streaming (SSE) para a resposta aparecer palavra por palavra.

export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    keyUrl: 'https://openrouter.ai/keys',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
}

class AIError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function friendlyError(status, raw) {
  if (status === 401 || status === 403) return 'Chave de API inválida ou sem permissão. Confira em Ajustes.'
  if (status === 429) return 'Limite de uso atingido. Espere um pouco ou troque de modelo.'
  if (status >= 500) return 'O provedor de IA está fora do ar. Tente de novo em instantes.'
  return raw || 'Falha ao falar com a IA.'
}

async function readError(res) {
  let raw = ''
  try {
    const data = await res.json()
    raw = data?.error?.message || data?.message || ''
  } catch {
    try { raw = await res.text() } catch { /* ignore */ }
  }
  throw new AIError(friendlyError(res.status, raw), res.status)
}

/**
 * Envia a conversa e chama onToken(texto) a cada pedaço recebido.
 * @returns {Promise<string>} a resposta completa
 */
export async function chat({ provider, apiKey, model, system, messages, signal, onToken }) {
  if (!apiKey) throw new AIError('Configure sua chave de API em Ajustes antes de conversar.', 0)
  const impl = { openai: openaiLike, openrouter: openaiLike, gemini: geminiChat }[provider]
  if (!impl) throw new AIError(`Provedor desconhecido: ${provider}`, 0)
  return impl({ provider, apiKey, model, system, messages, signal, onToken })
}

/* ---------- OpenAI / OpenRouter (mesma API) ---------- */
async function openaiLike({ provider, apiKey, model, system, messages, signal, onToken }) {
  const url =
    provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter' ? { 'X-Title': 'Personaia' } : {}),
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) await readError(res)

  return consumeSSE(res, (json) => json?.choices?.[0]?.delta?.content || '', onToken)
}

/* ---------- Google Gemini ---------- */
async function geminiChat({ apiKey, model, system, messages, signal, onToken }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
  })
  if (!res.ok) await readError(res)

  return consumeSSE(
    res,
    (json) => json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '',
    onToken
  )
}

/* ---------- Leitor de Server-Sent Events compartilhado ---------- */
async function consumeSSE(res, extract, onToken) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const piece = extract(JSON.parse(payload))
        if (piece) {
          full += piece
          onToken?.(piece)
        }
      } catch {
        /* pedaço incompleto: ignora */
      }
    }
  }
  return full
}
