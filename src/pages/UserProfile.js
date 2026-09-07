import React, { useState } from 'react';
import '../styles/PrecoFixo17Reference.css';

function UserProfile({ user, onLogout, onBack, onNavigate }) {
  const [userData, setUserData] = useState({
    name: user?.name || user?.fullName || 'João Silva',
    role: user?.userType === 'driver' ? 'Motorista Parceiro' : 'Passageiro',
    email: user?.email || 'joaosilva@email.com',
    phone: user?.phone || '(11) 98765-4321',
    rating: '4.9'
  });

  const [activeModal, setActiveModal] = useState(null); // 'info' | 'address' | 'saved'
  const [savedAddresses, setSavedAddresses] = useState([
    { id: 1, label: 'Casa', address: 'Av. das Palmeiras, 123 - Centro' },
    { id: 2, label: 'Trabalho', address: 'Rua dos Ipês, 456 - Jardim das Flores' }
  ]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof onLogout === 'function') onLogout();
  };

  return (
    <div className="pf-profile-screen">
      <style>{`
        .pf-profile-screen {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .pf-prof-topbar {
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
        .pf-prof-back {
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
        .pf-prof-back:hover { background: #161b22; }
        .pf-prof-title {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
        }
        .pf-prof-body {
          flex: 1;
          max-width: 440px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 16px 40px;
          display: flex;
          flex-direction: column;
        }
        .pf-prof-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 28px;
        }
        .pf-prof-avatar-wrap {
          position: relative;
          width: 88px;
          height: 88px;
          margin-bottom: 14px;
        }
        .pf-prof-avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 3px solid #ff5a00;
          object-fit: cover;
          background: #1c212a;
        }
        .pf-prof-avatar-edit {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 28px;
          height: 28px;
          background: #ff5a00;
          border-radius: 50%;
          border: 2px solid #050505;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
        }
        .pf-prof-name {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 4px;
        }
        .pf-prof-role {
          font-size: 14px;
          color: #8e98a5;
          margin: 0 0 4px;
        }
        .pf-prof-email {
          font-size: 13px;
          color: #6a7482;
          margin: 0 0 8px;
        }
        .pf-prof-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.25);
          color: #fbbf24;
          font-size: 13px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .pf-prof-menu {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 28px;
        }
        .pf-prof-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 16px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
          text-align: left;
          width: 100%;
        }
        .pf-prof-item:hover {
          background: #14181e;
          transform: translateX(2px);
        }
        .pf-prof-item-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pf-prof-item-icon {
          font-size: 18px;
          color: #8e98a5;
        }
        .pf-prof-chevron {
          color: #5c6674;
          font-size: 18px;
        }
        .pf-prof-logout-btn {
          width: 100%;
          background: #dc2626;
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          padding: 15px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .pf-prof-logout-btn:hover {
          background: #b91c1c;
        }
      `}</style>

      {/* Topbar */}
      <header className="pf-prof-topbar">
        <button
          type="button"
          className="pf-prof-back"
          onClick={() => onBack?.()}
          aria-label="Voltar"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pf-prof-title">Perfil</span>
        <div style={{ width: 38 }} />
      </header>

      {/* Profile Body */}
      <main className="pf-prof-body">
        {/* Hero */}
        <div className="pf-prof-hero">
          <div className="pf-prof-avatar-wrap">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80"
              alt={userData.name}
              className="pf-prof-avatar"
            />
            <div
              className="pf-prof-avatar-edit"
              title="Trocar foto"
              onClick={() => alert('Foto de perfil atualizada!')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
          </div>
          <h2 className="pf-prof-name">{userData.name}</h2>
          <div className="pf-prof-role">{userData.role}</div>
          <div className="pf-prof-email">{userData.email}</div>
          <div className="pf-prof-rating">
            <span>★</span>
            <span>{userData.rating}</span>
            <span>★</span>
          </div>
        </div>

        {/* Menu list */}
        <div className="pf-prof-menu">
          <button
            type="button"
            className="pf-prof-item"
            onClick={() => {
              const newName = window.prompt('Editar seu nome:', userData.name);
              if (newName && newName.trim()) {
                setUserData((prev) => ({ ...prev, name: newName.trim() }));
              }
            }}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">👤</span>
              <span>Informações pessoais</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>

          <button
            type="button"
            className="pf-prof-item"
            onClick={() => onNavigate?.('payment')}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">💳</span>
              <span>Formas de pagamento</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>

          <button
            type="button"
            className="pf-prof-item"
            onClick={() => {
              alert(`Endereços Salvos:\n- Casa: Av. das Palmeiras, 123\n- Trabalho: Rua dos Ipês, 456`);
            }}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">📍</span>
              <span>Endereços salvos</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>

          <button
            type="button"
            className="pf-prof-item"
            onClick={() => alert('Suas avaliações recentes: Motorista Carlos ★ 5.0')}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">⭐</span>
              <span>Avaliar motoristas</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>

          <button
            type="button"
            className="pf-prof-item"
            onClick={() => alert('Configurações do aplicativo: Notificações ativadas, Tema Escuro Oficial ativo.')}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">⚙️</span>
              <span>Configurações</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>

          <button
            type="button"
            className="pf-prof-item"
            onClick={() => alert('Central de Ajuda PreçoFixo17: suporte disponível 24h pelo WhatsApp.')}
          >
            <div className="pf-prof-item-left">
              <span className="pf-prof-item-icon">❓</span>
              <span>Ajuda e suporte</span>
            </div>
            <span className="pf-prof-chevron">›</span>
          </button>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          className="pf-prof-logout-btn"
          onClick={handleLogout}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair da conta
        </button>
      </main>
    </div>
  );
}

export default UserProfile;
