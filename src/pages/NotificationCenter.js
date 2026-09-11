import React, { useMemo, useState } from 'react';
import '../styles/PrecoFixo17Reference.css';

const DEFAULT_NOTIFICATIONS = [];

function currentAccountKey() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.uid || user?.id || user?.email || 'guest';
  } catch (_) { return 'guest'; }
}

function NotificationCenter({ onBack }) {
  const key = useMemo(() => `pf17_notifications_${currentAccountKey()}`, []);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (!Array.isArray(saved)) return DEFAULT_NOTIFICATIONS;
      const simulatedTitles = new Set(['Motorista a caminho', 'Corrida concluída', 'Promoção', 'Atualização']);
      const cleaned = saved.filter((item) => !simulatedTitles.has(item?.title));
      if (cleaned.length !== saved.length) localStorage.setItem(key, JSON.stringify(cleaned));
      return cleaned;
    } catch (_) { return DEFAULT_NOTIFICATIONS; }
  });

  const persist = (next) => {
    setNotifications(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
  };
  const markAllAsRead = () => persist(notifications.map((n) => ({ ...n, read: true })));
  const markAsRead = (id) => persist(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  const clearAll = () => {
    if (!notifications.length) return;
    if (window.confirm('Deseja excluir todas as notificações deste dispositivo?')) persist([]);
  };
  const getIcon = (type) => type === 'driver' ? '🚗' : type === 'completed' ? '✓' : type === 'promo' ? '🎁' : '🔔';

  return (
    <div className="pf-notif-screen">
      <style>{`.pf-notif-screen{min-height:100vh;background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}.pf-notif-topbar{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #1c2128;position:sticky;top:0;background:rgba(5,5,5,.95);backdrop-filter:blur(10px);z-index:10}.pf-notif-btn{background:transparent;border:none;color:#fff;cursor:pointer;padding:8px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:24px}.pf-notif-btn:hover{background:#161b22}.pf-notif-title{font-size:17px;font-weight:700}.pf-notif-body{flex:1;max-width:500px;width:100%;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column}.pf-notif-list{display:flex;flex-direction:column;gap:12px}.pf-notif-item{display:flex;align-items:flex-start;gap:14px;background:#0f1216;border:1px solid #222832;border-radius:18px;padding:16px;position:relative;cursor:pointer;transition:border-color .15s ease,background .15s ease}.pf-notif-item:hover{border-color:#353e4f;background:#14181e}.pf-notif-item.unread{border-color:rgba(255,90,0,.4)}.pf-notif-icon-circle{width:44px;height:44px;border-radius:50%;background:#ff5a00;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:900}.pf-notif-content{flex:1;min-width:0}.pf-notif-heading{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:12px}.pf-notif-time{font-size:12px;color:#8e98a5;font-weight:500}.pf-notif-desc{font-size:13px;color:#a3aebb;line-height:1.4;margin:0}.pf-notif-bottom-btn{margin-top:24px;background:#ff5a00;color:#fff;font-size:15px;font-weight:800;padding:14px;border:none;border-radius:999px;cursor:pointer;box-shadow:0 8px 24px rgba(255,90,0,.35);width:100%}.pf-notif-empty{text-align:center;padding:48px 16px;color:#8e98a5;background:#0f1216;border:1px dashed #242a34;border-radius:18px}`}</style>
      <header className="pf-notif-topbar"><button type="button" className="pf-notif-btn" onClick={() => onBack?.()} aria-label="Voltar">‹</button><span className="pf-notif-title">Notificações</span><button type="button" className="pf-notif-btn" onClick={clearAll} aria-label="Limpar notificações">🗑</button></header>
      <main className="pf-notif-body"><div className="pf-notif-list">
        {notifications.length === 0 ? <div className="pf-notif-empty">Nenhuma notificação no momento.</div> : notifications.map((item) => (
          <button key={item.id} type="button" className={`pf-notif-item ${!item.read ? 'unread' : ''}`} onClick={() => markAsRead(item.id)} style={{ width:'100%', textAlign:'left', borderWidth:1 }}><div className="pf-notif-icon-circle">{getIcon(item.type)}</div><div className="pf-notif-content"><div className="pf-notif-heading"><span>{item.title}</span><span className="pf-notif-time">{item.timeAgo}</span></div><p className="pf-notif-desc">{item.message}</p></div></button>
        ))}
      </div>{notifications.some((n) => !n.read) && <button type="button" className="pf-notif-bottom-btn" onClick={markAllAsRead}>Marcar todas como lidas</button>}</main>
    </div>
  );
}

export default NotificationCenter;
