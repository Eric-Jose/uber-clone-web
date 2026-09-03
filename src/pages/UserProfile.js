import React, { useEffect, useState } from 'react';
import '../styles/UserProfile.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function UserProfile({ user, onLogout, onRequestRide, onHistory }) {
  const [editMode, setEditMode] = useState(false);
  const [userData, setUserData] = useState(user || {});
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, distance: 0, ongoing: 0, rating: 5.0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); onLogout(); };
  const handleSave = () => {
    localStorage.setItem('user', JSON.stringify(userData));
    setEditMode(false);
  };

  useEffect(() => {
    let cancelled = false;
    const loadStats = async (showLoading = false) => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        if (showLoading) setStatsLoading(true);
        const response = await fetch(`${BACKEND_URL}/api/rides/history?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const rides = Array.isArray(data.rides) ? data.rides : [];
        const nextStats = {
          total: rides.length,
          completed: rides.filter((r) => r.status === 'COMPLETED').length,
          cancelled: rides.filter((r) => r.status === 'CANCELLED').length,
          ongoing: rides.filter((r) => ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length,
          distance: rides.reduce((sum, r) => sum + (Number(r.distance) || 0), 0),
          rating: Number(user?.rating ?? userData.rating ?? 5.0) || 5.0
        };
        setStats(nextStats);
        const mergedUser = { ...(user || {}), ...userData, totalRides: nextStats.total, rating: nextStats.rating };
        setUserData(mergedUser);
        localStorage.setItem('user', JSON.stringify(mergedUser));
      } catch (_) {
        // Mantém os últimos dados durante falhas momentâneas.
      } finally {
        if (!cancelled && showLoading) setStatsLoading(false);
      }
    };

    loadStats(true);
    const interval = window.setInterval(() => loadStats(false), 5000);
    const handleFocus = () => loadStats(false);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadStats(false); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, userData.rating]);

  return (
    <div className="user-profile-container">
      <div className="profile-header">
        <div className="profile-avatar"><span>{userData.name ? userData.name[0].toUpperCase() : '👤'}</span></div>
        <div className="profile-info">
          <h1>{userData.name || 'Usuário'}</h1>
          <p className="user-type">{userData.userType === 'driver' ? '🚗 Motorista' : '🚖 Passageiro'}</p>
          <p className="rating">⭐ {stats.rating.toFixed(1)} ({stats.total} corridas)</p>
        </div>
      </div>

      {userData.userType !== 'driver' && <div className="profile-card"><h2>🚗 Nova corrida</h2><p>Informe seu destino e solicite um motorista.</p><button className="btn-edit" onClick={onRequestRide}>📍 Solicitar Corrida</button></div>}
      {onHistory && <div className="profile-card"><h2>📋 Histórico</h2><p>Veja suas corridas concluídas, canceladas e em andamento.</p><button className="btn-edit" onClick={onHistory}>📋 Ver histórico de corridas</button></div>}

      <div className="profile-card">
        <h2>Informações Pessoais</h2>
        {!editMode ? <div className="info-display"><div className="info-item"><span className="label">📧 Email:</span><span className="value">{userData.email}</span></div><div className="info-item"><span className="label">📱 Telefone:</span><span className="value">{userData.phone || 'Não informado'}</span></div><div className="info-item"><span className="label">👤 Tipo de Conta:</span><span className="value">{userData.userType === 'driver' ? '🚗 Motorista' : '🚖 Passageiro'}</span></div><div className="info-item"><span className="label">📅 Membro desde:</span><span className="value">{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span></div></div> : <div className="info-edit"><div className="form-group"><label>Nome</label><input value={userData.name || ''} onChange={e => setUserData({...userData, name: e.target.value})} /></div><div className="form-group"><label>Telefone</label><input value={userData.phone || ''} onChange={e => setUserData({...userData, phone: e.target.value})} /></div></div>}
        <div className="profile-actions">{!editMode ? <button className="btn-edit" onClick={() => setEditMode(true)}>✏️ Editar</button> : <><button className="btn-save" onClick={handleSave}>💾 Salvar</button><button className="btn-cancel" onClick={() => { setUserData(user || {}); setEditMode(false); }}>❌ Cancelar</button></>}</div>
      </div>

      <div className="profile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><h2 style={{ margin: 0 }}>Estatísticas</h2><span style={{ color: '#666', fontSize: 12 }}>{statsLoading ? 'Atualizando…' : '● Atualizado automaticamente'}</span></div>
        <div className="stats-grid">
          <div className="stat-item"><span className="stat-number">{stats.total}</span><span className="stat-label">Corridas</span></div>
          <div className="stat-item"><span className="stat-number">{stats.rating.toFixed(1)}</span><span className="stat-label">Avaliação</span></div>
          <div className="stat-item"><span className="stat-number">{stats.cancelled}</span><span className="stat-label">Canceladas</span></div>
          <div className="stat-item"><span className="stat-number">{stats.distance.toFixed(1)} km</span><span className="stat-label">Distância</span></div>
          <div className="stat-item"><span className="stat-number">{stats.completed}</span><span className="stat-label">Concluídas</span></div>
          <div className="stat-item"><span className="stat-number">{stats.ongoing}</span><span className="stat-label">Em andamento</span></div>
        </div>
      </div>

      <div className="profile-card"><h2>Segurança</h2><div className="security-options"><button className="btn-option">🔐 Alterar Senha</button><button className="btn-option">🔑 Autenticação 2FA</button></div></div>
      <div className="profile-actions-bottom"><button className="btn-logout" onClick={handleLogout}>🚪 Sair da Conta</button></div>
    </div>
  );
}
export default UserProfile;
