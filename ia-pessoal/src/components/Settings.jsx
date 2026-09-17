import { useState } from 'react'
import { PROVIDERS } from '../lib/ai'

export default function Settings({ settings, onChange, onClose }) {
  const [local, setLocal] = useState(settings)
  const [showKey, setShowKey] = useState(false)
  const provider = PROVIDERS[local.provider]

  const setProvider = (id) =>
    setLocal((s) => ({ ...s, provider: id, model: PROVIDERS[id].defaultModel }))

  const setKey = (value) =>
    setLocal((s) => ({ ...s, keys: { ...s.keys, [s.provider]: value.trim() } }))

  const apply = () => {
    onChange(local)
    onClose()
  }

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>Ajustes</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </header>

        <label className="field">
          <span>Provedor de IA</span>
          <div className="chips">
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <button
                key={id}
                className={`chip ${local.provider === id ? 'on' : ''}`}
                onClick={() => setProvider(id)}
              >{p.label}</button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Modelo</span>
          <select value={local.model} onChange={(e) => setLocal((s) => ({ ...s, model: e.target.value }))}>
            {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
            {!provider.models.includes(local.model) && <option value={local.model}>{local.model}</option>}
          </select>
        </label>

        <label className="field">
          <span>Chave de API ({provider.label})</span>
          <div className="key-row">
            <input
              type={showKey ? 'text' : 'password'}
              value={local.keys[local.provider] || ''}
              onChange={(e) => setKey(e.target.value)}
              placeholder="cole sua chave aqui"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="ghost" onClick={() => setShowKey((v) => !v)}>{showKey ? 'ocultar' : 'ver'}</button>
          </div>
          <small>
            Guardada só no seu celular. <a href={provider.keyUrl} target="_blank" rel="noreferrer">Pegar chave</a>
          </small>
        </label>

        <label className="field">
          <span>Personalidade</span>
          <textarea
            rows={4}
            value={local.persona}
            onChange={(e) => setLocal((s) => ({ ...s, persona: e.target.value }))}
            placeholder="Como a IA deve se comportar…"
          />
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={local.speak}
            onChange={(e) => setLocal((s) => ({ ...s, speak: e.target.checked }))}
          />
          <span>Ler respostas em voz alta</span>
        </label>

        <button className="primary" onClick={apply}>Salvar</button>
      </div>
    </div>
  )
}
