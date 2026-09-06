import React, { useState } from 'react';
import '../styles/Notifications.css';

function NotificationCenter() {
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'ride_request', title: 'Corrida aceita!', message: 'Seu motorista está a caminho.', timestamp: new Date(Date.now() - 5 * 60000), read: false },
    { id: 2, type: 'ride_progress', title: 'Corrida em andamento', message: 'Sua corrida está acontecendo normalmente.', timestamp: new Date(Date.now() - 30 * 60000), read: false },
    { id: 3, type: 'arrival', title: 'Chegada ao destino', message: 'Sua corrida foi concluída. Obrigado por viajar com o PreçoFixo17.', timestamp: new Date(Date.now() - 2 * 60 * 60000), read: true },
    { id: 4, type: 'rating', title: 'Avaliação', message: 'Avalie sua última corrida e ajude a melhorar o serviço.', timestamp: new Date(Date.now() - 24 * 60 * 60000), read: true },
    { id: 5, type: 'promo', title: 'Promoções', message: 'Confira novidades e ofertas do PreçoFixo17.', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000), read: true }
  ]);
  const [filter, setFilter] = useState('all');
  const markAsRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const deleteNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;
  const icon = (type) => ({ ride_request: '🚗', ride_progress: '📍', arrival: '🏁', rating: '⭐', promo: '🎁', driver_approved: '✓', payment_success: 'R$', message: '💬' }[type] || '🔔');

  return (
    <div className="notification-center">
      <div className="notification-header">
        <div><span className="notification-kicker">PREÇO FIXO 17</span><h2>Notificações</h2></div>
        {unreadCount > 0 && <span className="unread-badge">{unreadCount} nova{unreadCount > 1 ? 's' : ''}</span>}
      </div>
      <div className="notification-actions"><div className="notification-filters"><button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas ({notifications.length})</button><button className={`filter-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Não lidas ({unreadCount})</button></div>{unreadCount > 0 && <button className="mark-all-btn" onClick={markAllAsRead}>Marcar todas como lidas</button>}</div>
      <div className="notifications-list">
        {filtered.length ? filtered.map(n => <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`} onClick={() => markAsRead(n.id)}>
          <div className="notification-icon">{icon(n.type)}</div><div className="notification-content"><h3>{n.title}</h3><p>{n.message}</p><span className="timestamp">{formatTimeAgo(n.timestamp)}</span></div><button aria-label="Excluir notificação" className="btn-close-notification" onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}>✕</button>
        </div>) : <div className="empty-state"><div>🔔</div><p>Nenhuma notificação</p></div>}
      </div>
    </div>
  );
}
function formatTimeAgo(date) { const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000)); const minutes = Math.floor(seconds / 60); const hours = Math.floor(minutes / 60); const days = Math.floor(hours / 24); if (seconds < 60) return 'agora'; if (minutes < 60) return `há ${minutes} min`; if (hours < 24) return `há ${hours} h`; return `há ${days} d`; }
export default NotificationCenter;
