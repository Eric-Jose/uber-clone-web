import React, { useState, useEffect } from 'react';
import '../styles/Notifications.css';

function NotificationCenter() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'ride_request',
      title: '🚗 Nova Corrida Disponível',
      message: 'Corrida de R$ 25,00 a 2km de você',
      timestamp: new Date(Date.now() - 5 * 60000),
      read: false
    },
    {
      id: 2,
      type: 'driver_approved',
      title: '✅ Cadastro Aprovado',
      message: 'Seu cadastro como motorista foi aprovado!',
      timestamp: new Date(Date.now() - 30 * 60000),
      read: false
    },
    {
      id: 3,
      type: 'payment_success',
      title: '💳 Pagamento Recebido',
      message: 'Pagamento de R$ 32,50 processado com sucesso',
      timestamp: new Date(Date.now() - 2 * 60 * 60000),
      read: true
    },
    {
      id: 4,
      type: 'rating',
      title: '⭐ Nova Avaliação',
      message: 'Você recebeu uma avaliação de 5 estrelas',
      timestamp: new Date(Date.now() - 24 * 60 * 60000),
      read: true
    }
  ]);

  const [filter, setFilter] = useState('all');

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'ride_request': return '🚗';
      case 'driver_approved': return '✅';
      case 'payment_success': return '💳';
      case 'rating': return '⭐';
      case 'message': return '💬';
      default: return '🔔';
    }
  };

  return (
    <div className="notification-center">
      <div className="notification-header">
        <h2>🔔 Notificações</h2>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </div>

      <div className="notification-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({notifications.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Não Lidas ({unreadCount})
        </button>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <h3>{notification.title}</h3>
                <p>{notification.message}</p>
                <span className="timestamp">
                  {formatTimeAgo(notification.timestamp)}
                </span>
              </div>
              <button
                className="btn-close-notification"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
              >
                ✕
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>📭 Nenhuma notificação</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'agora';
  if (minutes < 60) return `há ${minutes}m`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
}

export default NotificationCenter;
