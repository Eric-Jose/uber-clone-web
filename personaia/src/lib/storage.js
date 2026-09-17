// Persistência local (localStorage). Nada sai do celular além das chamadas à IA.
const KEY = 'personaia:v1'

const DEFAULTS = {
  settings: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    keys: { openai: '', openrouter: '', gemini: '' },
    persona:
      'Você é uma IA pessoal, direta e prestativa. Responde em português do Brasil, com clareza e sem enrolação.',
    speak: false,
  },
  chats: [],
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw)
    return {
      settings: { ...DEFAULTS.settings, ...parsed.settings, keys: { ...DEFAULTS.settings.keys, ...parsed.settings?.keys } },
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* cota cheia: ignora */
  }
}

export const newChat = () => ({
  id: crypto.randomUUID(),
  title: 'Nova conversa',
  createdAt: Date.now(),
  messages: [],
})

export const titleFrom = (text) =>
  text.replace(/\s+/g, ' ').trim().slice(0, 38) || 'Nova conversa'
