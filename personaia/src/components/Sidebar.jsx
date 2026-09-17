export default function Sidebar({ open, chats, activeId, onSelect, onNew, onDelete, onClose }) {
  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <button className="new-chat" onClick={onNew}>+ Nova conversa</button>
        <div className="chat-list">
          {chats.map((c) => (
            <div key={c.id} className={`chat-item ${c.id === activeId ? 'active' : ''}`}>
              <button className="chat-title" onClick={() => onSelect(c.id)}>
                <span>{c.title}</span>
                <small>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</small>
              </button>
              <button className="del" onClick={() => onDelete(c.id)} aria-label="Apagar">✕</button>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
