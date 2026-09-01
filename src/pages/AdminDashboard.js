import React, { useState, useEffect } from 'react';
import '../styles/AdminDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function AdminDashboard({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalRides: 0,
    totalUsers: 0,
    totalDrivers: 0,
    totalRevenue: 0,
    pendingDrivers: 0
  });

  const [banners, setBanners] = useState([
    {
      id: 1,
      title: 'Promoção de Verão',
      description: 'Ganhe 20% de desconto',
      imageUrl: '🌞',
      active: true,
      createdAt: new Date()
    }
  ]);

  const [newBanner, setNewBanner] = useState({
    title: '',
    description: '',
    imageUrl: '',
    active: true
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Simular carregamento de dados
      setStats({
        totalRides: 1247,
        totalUsers: 3456,
        totalDrivers: 892,
        totalRevenue: 45230.50,
        pendingDrivers: 23
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleAddBanner = (e) => {
    e.preventDefault();
    if (!newBanner.title || !newBanner.description) {
      alert('Preencha todos os campos!');
      return;
    }

    const banner = {
      id: banners.length + 1,
      ...newBanner,
      createdAt: new Date()
    };

    setBanners([...banners, banner]);
    setNewBanner({ title: '', description: '', imageUrl: '', active: true });
    alert('✅ Banner adicionado com sucesso!');
  };

  const handleDeleteBanner = (id) => {
    if (window.confirm('Tem certeza que deseja deletar este banner?')) {
      setBanners(banners.filter(b => b.id !== id));
      alert('✅ Banner deletado!');
    }
  };

  const handleToggleBanner = (id) => {
    setBanners(banners.map(b => 
      b.id === id ? { ...b, active: !b.active } : b
    ));
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>🎛️ Painel de Controle Administrativo</h1>
          <p>Bem-vindo, {admin.name}</p>
        </div>
        <button className="btn-logout" onClick={onLogout}>🚪 Sair</button>
      </div>

      {/* Navegação de Abas */}
      <div className="dashboard-nav">
        <button
          className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Visão Geral
        </button>
        <button
          className={`nav-btn ${activeTab === 'banners' ? 'active' : ''}`}
          onClick={() => setActiveTab('banners')}
        >
          🎨 Banners & Anúncios
        </button>
        <button
          className={`nav-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          🚗 Motoristas
        </button>
        <button
          className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`}
          onClick={() => setActiveTab('finance')}
        >
          💰 Financeiro
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Configurações
        </button>
      </div>

      {/* Conteúdo */}
      <div className="dashboard-content">
        {/* TAB: Visão Geral */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>📊 Visão Geral do Sistema</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🚗</div>
                <div className="stat-info">
                  <span className="stat-label">Total de Corridas</span>
                  <span className="stat-value">{stats.totalRides.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <span className="stat-label">Total de Usuários</span>
                  <span className="stat-value">{stats.totalUsers.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🚕</div>
                <div className="stat-info">
                  <span className="stat-label">Total de Motoristas</span>
                  <span className="stat-value">{stats.totalDrivers.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <span className="stat-label">Faturamento Total</span>
                  <span className="stat-value">R$ {stats.totalRevenue.toFixed(2)}</span>
                </div>
              </div>
              <div className="stat-card alert">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <span className="stat-label">Motoristas Pendentes</span>
                  <span className="stat-value">{stats.pendingDrivers}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Banners & Anúncios */}
        {activeTab === 'banners' && (
          <div className="banners-section">
            <h2>🎨 Gerenciador de Banners e Anúncios</h2>

            {/* Formulário de Novo Banner */}
            <div className="banner-form-card">
              <h3>➕ Criar Novo Banner</h3>
              <form onSubmit={handleAddBanner} className="banner-form">
                <div className="form-group">
                  <label>📝 Título</label>
                  <input
                    type="text"
                    placeholder="Ex: Promoção de Verão"
                    value={newBanner.title}
                    onChange={(e) => setNewBanner({...newBanner, title: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>📄 Descrição</label>
                  <textarea
                    placeholder="Ex: Ganhe 20% de desconto em suas próximas corridas"
                    value={newBanner.description}
                    onChange={(e) => setNewBanner({...newBanner, description: e.target.value})}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>🖼️ URL da Imagem</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={newBanner.imageUrl}
                    onChange={(e) => setNewBanner({...newBanner, imageUrl: e.target.value})}
                  />
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={newBanner.active}
                      onChange={(e) => setNewBanner({...newBanner, active: e.target.checked})}
                    />
                    ✅ Ativar Banner
                  </label>
                </div>

                <button type="submit" className="btn-submit">🚀 Criar Banner</button>
              </form>
            </div>

            {/* Lista de Banners */}
            <div className="banners-list">
              <h3>📋 Banners Ativos</h3>
              {banners.length > 0 ? (
                banners.map(banner => (
                  <div key={banner.id} className={`banner-item ${!banner.active ? 'inactive' : ''}`}>
                    <div className="banner-preview">
                      <div className="preview-image">{banner.imageUrl || '🖼️'}</div>
                    </div>
                    <div className="banner-details">
                      <h4>{banner.title}</h4>
                      <p>{banner.description}</p>
                      <span className="banner-date">
                        Criado em: {new Date(banner.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="banner-actions">
                      <button
                        className={`btn-toggle ${banner.active ? 'active' : ''}`}
                        onClick={() => handleToggleBanner(banner.id)}
                      >
                        {banner.active ? '✅ Ativo' : '❌ Inativo'}
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteBanner(banner.id)}
                      >
                        🗑️ Deletar
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">Nenhum banner criado ainda</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: Motoristas */}
        {activeTab === 'drivers' && (
          <div className="drivers-section">
            <h2>🚗 Gerenciamento de Motoristas</h2>
            <p className="section-description">Acesse o painel de aprovação de motoristas para gerenciar cadastros pendentes.</p>
            <div className="action-buttons">
              <button className="btn-action" onClick={() => setActiveTab('overview')}>
                📋 Ver Motoristas Pendentes
              </button>
              <button className="btn-action">
                📊 Relatório de Motoristas
              </button>
            </div>
          </div>
        )}

        {/* TAB: Financeiro */}
        {activeTab === 'finance' && (
          <div className="finance-section">
            <h2>💰 Controle Financeiro</h2>
            <div className="finance-overview">
              <div className="finance-card">
                <h3>💵 Faturamento Mensal</h3>
                <p className="amount">R$ {stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="finance-card">
                <h3>📈 Crescimento</h3>
                <p className="amount growth">+15.3%</p>
              </div>
              <div className="finance-card">
                <h3>📉 Comissão Retida</h3>
                <p className="amount">R$ {(stats.totalRevenue * 0.2).toFixed(2)}</p>
              </div>
              <div className="finance-card">
                <h3>💸 Pagamentos Motoristas</h3>
                <p className="amount">R$ {(stats.totalRevenue * 0.8).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Configurações */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>⚙️ Configurações do Sistema</h2>
            <div className="settings-grid">
              <div className="setting-card">
                <h3>🔐 Segurança</h3>
                <button className="btn-setting">Alterar Senha</button>
                <button className="btn-setting">Ativar 2FA</button>
              </div>
              <div className="setting-card">
                <h3>📧 Notificações</h3>
                <button className="btn-setting">Email Notifications</button>
                <button className="btn-setting">Push Notifications</button>
              </div>
              <div className="setting-card">
                <h3>📋 Logs & Auditoria</h3>
                <button className="btn-setting">Ver Logs de Acesso</button>
                <button className="btn-setting">Relatório de Auditoria</button>
              </div>
              <div className="setting-card">
                <h3>🔧 Manutenção</h3>
                <button className="btn-setting">Backup do Sistema</button>
                <button className="btn-setting">Limpeza de Cache</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
