import React, { useState } from 'react';
import '../styles/UserProfile.css';

function UserProfile({ user, onLogout, onRequestRide }) {
  const [editMode, setEditMode] = useState(false);
  const [userData, setUserData] = useState(user || {});

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); onLogout(); };
  const handleSave = () => { localStorage.setItem('user', JSON.stringify(userData)); setEditMode(false); };

  return (
    <div className="user-profile-container">
      <div className="profile-header"><div className="profile-avatar"><span>{userData.name ? userData.name[0].toUpperCase() : '👤'}</span></div><div className="profile-info"><h1>{userData.name || 'Usuário'}</h1><p className="user-type">{userData.userType === 'driver' ? '🚗 Motorista' : '🚖 Passageiro'}</p>{userData.rating && <p className="rating">⭐ {userData.rating} ({userData.totalRides || 0} corridas)</p>}</div></div>
      {userData.userType !== 'driver' && <div className="profile-card"><h2>🚗 Nova corrida</h2><p>Informe seu destino e solicite um motorista.</p><button className="btn-edit" onClick={onRequestRide}>📍 Solicitar Corrida</button></div>}
      <div className="profile-card"><h2>Informações Pessoais</h2>{!editMode ? <div className="info-display"><div className="info-item"><span className="label">📧 Email:</span><span className="value">{userData.email}</span></div><div className="info-item"><span className="label">📱 Telefone:</span><span className="value">{userData.phone || 'Não informado'}</span></div><div className="info-item"><span className="label">👤 Tipo de Conta:</span><span className="value">{userData.userType === 'driver' ? '🚗 Motorista' : '🚖 Passageiro'}</span></div><div className="info-item"><span className="label">📅 Membro desde:</span><span className="value">{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span></div></div> : <div className="info-edit"><div className="form-group"><label>Nome</label><input value={userData.name || ''} onChange={e => setUserData({...userData, name: e.target.value})} /></div><div className="form-group"><label>Telefone</label><input value={userData.phone || ''} onChange={e => setUserData({...userData, phone: e.target.value})} /></div></div>}<div className="profile-actions">{!editMode ? <button className="btn-edit" onClick={() => setEditMode(true)}>✏️ Editar</button> : <><button className="btn-save" onClick={handleSave}>💾 Salvar</button><button className="btn-cancel" onClick={() => setEditMode(false)}>❌ Cancelar</button></>}</div></div>
      <div className="profile-card"><h2>Estatísticas</h2><div className="stats-grid"><div className="stat-item"><span className="stat-number">{userData.totalRides || 0}</span><span className="stat-label">Corridas</span></div><div className="stat-item"><span className="stat-number">{userData.rating || 5.0}</span><span className="stat-label">Avaliação</span></div><div className="stat-item"><span className="stat-number">0</span><span className="stat-label">Canceladas</span></div><div className="stat-item"><span className="stat-number">0 km</span><span className="stat-label">Distância</span></div></div></div>
      <div className="profile-card"><h2>Segurança</h2><div className="security-options"><button className="btn-option">🔐 Alterar Senha</button><button className="btn-option">🔑 Autenticação 2FA</button></div></div>
      <div className="profile-actions-bottom"><button className="btn-logout" onClick={handleLogout}>🚪 Sair da Conta</button></div>
    </div>
  );
}
export default UserProfile;
