import React, { useState } from 'react';
import '../styles/PrecoFixo17Reference.css';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    type: 'driver',
    title: 'Motorista a caminho',
    message: 'O motorista Carlos está a caminho do seu local.',
    timeAgo: 'agora',
    read: false
  },
  {
    id: 2,
    type: 'completed',
    title: 'Corrida concluída',
    message: 'Sua corrida para Rua dos Ipês foi concluída com sucesso.',
    timeAgo: 'há 10 min',
    read: false
  },
  {
    id: 3,
    type: 'promo',
    title: 'Promoção',
    message: 'Ganhe desconto especial na sua próxima viagem pelo PreçoFixo17.',
    timeAgo: 'há 2 h',
    read: true
  },
  {
    id: 4,
    type: 'system',
    title: 'Atualização',
    message: 'Nova versão disponível do aplicativo PreçoFixo17 com melhorias.',
    timeAgo: 'há 1 dia',
    read: true
  }
];

function NotificationCenter({ onBack }) {
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    if (window.confirm('Deseja excluir todas as notificações?')) {
      setNotifications([]);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'driver':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        );
      case 'completed':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'promo':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
    }
  };

  return (
    <div className="pf-notif-screen">
      <style>{`
        .pf-notif-screen {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .pf-notif-topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid #1c2128;
          position: sticky;
          top: 0;
          background: rgba(5, 5, 5, 0.95);
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .pf-notif-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .pf-notif-btn:hover { background: #161b22; }
        .pf-notif-title {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
        }
        .pf-notif-body {
          flex: 1;
          max-width: 500px;
          width: 100%;
          margin: 0 auto;
          padding: 20px 16px 40px;
          display: flex;
          flex-direction: column;
        }
        .pf-notif-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pf-notif-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 18px;
          padding: 16px;
          position: relative;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .pf-notif-item:hover {
          border-color: #353e4f;
          background: #14181e;
        }
        .pf-notif-item.unread {
          border-color: rgba(255, 90, 0, 0.4);
        }
        .pf-notif-icon-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ff5a00;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(255, 90, 0, 0.35);
        }
        .pf-notif-content {
          flex: 1;
          min-width: 0;
        }
        .pf-notif-heading {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pf-notif-time {
          font-size: 12px;
          color: #8e98a5;
          font-weight: 500;
        }
        .pf-notif-desc {
          font-size: 13px;
          color: #a3aebb;
          line-height: 1.4;
          margin: 0;
        }
        .pf-notif-bottom-btn {
          margin-top: 24px;
          background: #ff5a00;
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          padding: 14px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 90, 0, 0.35);
          transition: background 0.15s ease;
          width: 100%;
        }
        .pf-notif-bottom-btn:hover {
          background: #ff6a16;
        }
        .pf-notif-empty {
          text-align: center;
          padding: 48px 16px;
          color: #8e98a5;
          background: #0f1216;
          border: 1px dashed #242a34;
          border-radius: 18px;
        }
      `}</style>

      {/* Header */}
      <header className="pf-notif-topbar">
        <button
          type="button"
          className="pf-notif-btn"
          onClick={() => onBack?.()}
          aria-label="Voltar"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pf-notif-title">Notificações</span>
        <button
          type="button"
          className="pf-notif-btn"
          onClick={clearAll}
          aria-label="Limpar notificações"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e98a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </header>

      {/* Body */}
      <main className="pf-notif-body">
        <div className="pf-notif-list">
          {notifications.length === 0 ? (
            <div className="pf-notif-empty">Nenhuma notificação no momento.</div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`pf-notif-item ${!item.read ? 'unread' : ''}`}
                onClick={() => {
                  setNotifications((prev) =>
                    prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                  );
                }}
              >
                <div className="pf-notif-icon-circle">{getIcon(item.type)}</div>
                <div className="pf-notif-content">
                  <div className="pf-notif-heading">
                    <span>{item.title}</span>
                    <span className="pf-notif-time">{item.timeAgo}</span>
                  </div>
                  <p className="pf-notif-desc">{item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            className="pf-notif-bottom-btn"
            onClick={markAllAsRead}
          >
            Marcar todas como lidas
          </button>
        )}
      </main>
    </div>
  );
}

export default NotificationCenter;
