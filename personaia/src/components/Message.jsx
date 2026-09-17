import { useState } from 'react'

// Render leve de markdown: **negrito**, *itálico*, `código`, ```blocos``` e listas.
function renderInline(text) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return { __html: html }
}

function Body({ content }) {
  const parts = content.split(/```/)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <pre key={i}><code>{part.replace(/^\w*\n/, '')}</code></pre>
    ) : (
      <p key={i} dangerouslySetInnerHTML={renderInline(part)} />
    )
  )
}

export default function Message({ message, onSpeak }) {
  const [copied, setCopied] = useState(false)
  const mine = message.role === 'user'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className={`msg ${mine ? 'me' : 'ai'}`}>
      <div className="bubble">
        {message.content ? <Body content={message.content} /> : <span className="typing"><i/><i/><i/></span>}
      </div>
      {!mine && message.content && (
        <div className="msg-actions">
          <button onClick={copy}>{copied ? 'copiado ✓' : 'copiar'}</button>
          <button onClick={onSpeak}>ouvir</button>
        </div>
      )}
    </div>
  )
}
