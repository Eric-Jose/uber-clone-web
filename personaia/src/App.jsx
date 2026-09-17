import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chat, PROVIDERS } from './lib/ai'
import { load, save, newChat, titleFrom } from './lib/storage'
import { createRecognizer, speak, speechSupported, stopSpeaking } from './lib/voice'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'
import Message from './components/Message'
import Composer from './components/Composer'

export default function App() {
  const initial = useMemo(load, [])
  const [settings, setSettings] = useState(initial.settings)
  const [chats, setChats] = useState(initial.chats.length ? initial.chats : [newChat()])
  const [activeId, setActiveId] = useState(
    initial.chats.length ? initial.chats[0].id : null
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  const abortRef = useRef(null)
  const recRef = useRef(null)
  const bottomRef = useRef(null)

  const active = chats.find((c) => c.id === activeId) ?? chats[0]

  useEffect(() => {
    if (!activeId && chats[0]) setActiveId(chats[0].id)
  }, [activeId, chats])

  useEffect(() => {
    save({ settings, chats })
  }, [settings, chats])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages])

  const patchChat = useCallback((id, fn) => {
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
  }, [])

  const send = useCallback(
    async (textInput) => {
      const text = (textInput ?? draft).trim()
      if (!text || busy || !active) return

      setError('')
      setDraft('')
      setBusy(true)
      stopSpeaking()

      const userMsg = { id: crypto.randomUUID(), role: 'user', content: text }
      const replyId = crypto.randomUUID()

      patchChat(active.id, (c) => ({
        ...c,
        title: c.messages.length === 0 ? titleFrom(text) : c.title,
        messages: [...c.messages, userMsg, { id: replyId, role: 'assistant', content: '' }],
      }))

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const history = [...active.messages, userMsg].slice(-20)
        const full = await chat({
          provider: settings.provider,
          apiKey: settings.keys[settings.provider],
          model: settings.model,
          system: settings.persona,
          messages: history,
          signal: controller.signal,
          onToken: (piece) =>
            patchChat(active.id, (c) => ({
              ...c,
              messages: c.messages.map((m) =>
                m.id === replyId ? { ...m, content: m.content + piece } : m
              ),
            })),
        })
        if (settings.speak && full) speak(full)
      } catch (err) {
        if (err.name === 'AbortError') {
          patchChat(active.id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === replyId && !m.content ? { ...m, content: '_(interrompido)_' } : m
            ),
          }))
        } else {
          setError(err.message)
          patchChat(active.id, (c) => ({
            ...c,
            messages: c.messages.filter((m) => m.id !== replyId),
          }))
        }
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [active, busy, draft, patchChat, settings]
  )

  const stop = () => abortRef.current?.abort()

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = createRecognizer({
      onText: (text, final) => {
        setDraft(text)
        if (final) {
          setListening(false)
          send(text)
        }
      },
      onEnd: () => setListening(false),
      onError: (e) => {
        setListening(false)
        setError(e === 'not-allowed' ? 'Permissão de microfone negada.' : 'Não consegui ouvir. Tente de novo.')
      },
    })
    if (!rec) return setError('Reconhecimento de voz não disponível neste dispositivo.')
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const createChat = () => {
    const c = newChat()
    setChats((prev) => [c, ...prev])
    setActiveId(c.id)
    setShowSidebar(false)
  }

  const deleteChat = (id) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id)
      const result = next.length ? next : [newChat()]
      if (id === activeId) setActiveId(result[0].id)
      return result
    })
  }

  const hasKey = !!settings.keys[settings.provider]

  return (
    <div className="app">
      <Sidebar
        open={showSidebar}
        chats={chats}
        activeId={active?.id}
        onSelect={(id) => { setActiveId(id); setShowSidebar(false) }}
        onNew={createChat}
        onDelete={deleteChat}
        onClose={() => setShowSidebar(false)}
      />

      <header className="topbar">
        <button className="icon-btn" onClick={() => setShowSidebar(true)} aria-label="Conversas">☰</button>
        <div className="topbar-title">
          <strong>Personaia</strong>
          <span>{PROVIDERS[settings.provider].label} · {settings.model}</span>
        </div>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Ajustes">⚙</button>
      </header>

      <main className="messages">
        {!hasKey && (
          <div className="banner">
            Configure sua chave de API em <button className="link" onClick={() => setShowSettings(true)}>Ajustes</button> para começar.
          </div>
        )}

        {active?.messages.length === 0 && hasKey && (
          <div className="empty">
            <h1>Olá 👋</h1>
            <p>Sou sua IA pessoal. Pergunte qualquer coisa.</p>
            <div className="suggestions">
              {['Resuma meu dia em 3 tarefas', 'Explique isso como se eu tivesse 10 anos', 'Me ajude a escrever uma mensagem'].map((s) => (
                <button key={s} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {active?.messages.map((m) => (
          <Message key={m.id} message={m} onSpeak={() => speak(m.content)} />
        ))}

        {error && <div className="error">{error}</div>}
        <div ref={bottomRef} />
      </main>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send()}
        onStop={stop}
        onMic={toggleMic}
        busy={busy}
        listening={listening}
        micAvailable={speechSupported()}
      />

      {showSettings && (
        <Settings
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
