import { useEffect, useRef } from 'react'

export default function Composer({ value, onChange, onSend, onStop, onMic, busy, listening, micAvailable }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [value])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <footer className="composer">
      {micAvailable && (
        <button
          className={`mic ${listening ? 'on' : ''}`}
          onClick={onMic}
          aria-label="Falar"
        >🎤</button>
      )}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder={listening ? 'Ouvindo…' : 'Escreva sua mensagem'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {busy ? (
        <button className="send stop" onClick={onStop} aria-label="Parar">■</button>
      ) : (
        <button className="send" onClick={onSend} disabled={!value.trim()} aria-label="Enviar">➤</button>
      )}
    </footer>
  )
}
