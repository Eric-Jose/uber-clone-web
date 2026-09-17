// Voz: ditado (Web Speech API) e leitura em voz alta (SpeechSynthesis).

export function speechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createRecognizer({ lang = 'pt-BR', onText, onEnd, onError }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = lang
  rec.continuous = false
  rec.interimResults = true

  rec.onresult = (e) => {
    let text = ''
    for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript
    onText?.(text, e.results[e.results.length - 1].isFinal)
  }
  rec.onerror = (e) => onError?.(e.error)
  rec.onend = () => onEnd?.()
  return rec
}

export function speak(text, lang = 'pt-BR') {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 1.02
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
