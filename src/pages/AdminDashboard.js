import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/AdminDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function AdminDashboard({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionUid, setActionUid] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({ pendingDrivers: 0, totalDrivers: 0, approvedDrivers: 0, rejectedDrivers: 0 });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const getToken = () => localStorage.getItem('adminToken') || localStorage.getItem('token');

  const loadApplications = async () => {
    const token = getToken();
    if (!token) { setError('Sessão administrativa não encontrada. Faça login novamente.'); return; }
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/drivers/applications`, { headers: { Authorization: `Bearer ${token}` } });
      const list = Array.isArray(response.data?.applications) ? response.data.applications : [];
      setApplications(list);
      setStats({ pendingDrivers: list.filter((i) => i.status === 'pending').length, totalDrivers: list.length, approvedDrivers: list.filter((i) => i.status === 'approved').length, rejectedDrivers: list.filter((i) => i.status === 'rejected').length });
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível carregar os cadastros de motoristas.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadApplications(); }, []);

  const reviewDriver = async (uid, status) => {
    const token = getToken(); if (!token) return;
    setActionUid(uid); setError(''); setSuccess('');
    try {
      await axios.patch(`${BACKEND_URL}/api/drivers/${uid}/approval`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(status === 'approved' ? 'Motorista aprovado com sucesso.' : 'Cadastro de motorista rejeitado.');
      await loadApplications();
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível atualizar a aprovação.'); }
    finally { setActionUid(null); }
  };

  const changePassword = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (newPassword.length < 8) { setError('A nova senha deve ter pelo menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('A confirmação da nova senha não confere.'); return; }
    const token = getToken();
    if (!token) { setError('Sessão administrativa não encontrada. Faça login novamente.'); return; }
    setChangingPassword(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/admin/set-password`, { newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      setNewPassword(''); setConfirmPassword('');
      setSuccess(response.data?.message || 'Senha alterada com sucesso.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível alterar a senha.');
    } finally { setChangingPassword(false); }
  };

  const maskCpf = (cpf = '') => { const digits = String(cpf).replace(/\D/g, ''); if (digits.length !== 11) return cpf || '—'; return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`; };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header"><div className="header-content"><h1>🎛️ Painel Administrativo</h1><p>Bem-vindo, {admin?.name || 'Administrador'}</p></div><button className="btn-logout" onClick={onLogout}>🚪 Sair</button></div>
      <div className="dashboard-nav">
        <button className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>📊 Visão Geral</button>
        <button className={`nav-btn ${activeTab === 'drivers' ? 'active' : ''}`} onClick={() => setActiveTab('drivers')}>🚗 Motoristas</button>
        <button className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>💰 Financeiro</button>
        <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Configurações</button>
      </div>
      {error && <div className="dashboard-content"><div className="section-description">❌ {error}</div></div>}
      {success && <div className="dashboard-content"><div className="section-description">✅ {success}</div></div>}
      <div className="dashboard-content">
        {activeTab === 'overview' && <div className="overview-section"><h2>📊 Visão Geral</h2><div className="stats-grid"><div className="stat-card"><div className="stat-icon">🚗</div><div className="stat-info"><span className="stat-label">Cadastros de Motoristas</span><span className="stat-value">{stats.totalDrivers}</span></div></div><div className="stat-card alert"><div className="stat-icon">⏳</div><div className="stat-info"><span className="stat-label">Pendentes</span><span className="stat-value">{stats.pendingDrivers}</span></div></div><div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><span className="stat-label">Aprovados</span><span className="stat-value">{stats.approvedDrivers}</span></div></div><div className="stat-card"><div className="stat-icon">❌</div><div className="stat-info"><span className="stat-label">Rejeitados</span><span className="stat-value">{stats.rejectedDrivers}</span></div></div></div><div className="action-buttons" style={{ marginTop: 20 }}><button className="btn-action" onClick={() => { setActiveTab('drivers'); loadApplications(); }}>🔄 Atualizar cadastros</button></div></div>}
        {activeTab === 'drivers' && <div className="drivers-section"><h2>🚗 Aprovação de Motoristas</h2><p className="section-description">Analise os cadastros enviados e aprove somente motoristas que cumprirem os requisitos.</p>{loading ? <p>Carregando cadastros...</p> : applications.length === 0 ? <p className="empty-state">Nenhum cadastro encontrado.</p> : <div className="drivers-list">{applications.map((driver) => <div className="banner-item" key={driver.uid}><div className="banner-details"><h4>{driver.fullName || 'Motorista sem nome'}</h4><p>📧 {driver.email || '—'} · 📱 {driver.phone || '—'}</p><p>🪪 CPF: {maskCpf(driver.cpf)} · 🚘 {driver.vehicleModel || '—'} · Placa: {driver.licensePlate || '—'}</p><p>📄 {driver.documentCount || 0} documentos · Enviado: {driver.submittedAt ? new Date(driver.submittedAt).toLocaleString('pt-BR') : '—'}</p><strong>Status: {driver.status === 'pending' ? '⏳ Pendente' : driver.status === 'approved' ? '✅ Aprovado' : '❌ Rejeitado'}</strong></div>{driver.status === 'pending' && <div className="banner-actions"><button className="btn-submit" disabled={actionUid === driver.uid} onClick={() => reviewDriver(driver.uid, 'approved')}>{actionUid === driver.uid ? 'Aguarde...' : '✅ Aprovar'}</button><button className="btn-delete" disabled={actionUid === driver.uid} onClick={() => reviewDriver(driver.uid, 'rejected')}>❌ Rejeitar</button></div>}</div>)}</div>}</div>}
        {activeTab === 'finance' && <div className="finance-section"><h2>💰 Financeiro</h2><p className="section-description">Os dados financeiros reais serão conectados ao provedor de pagamentos. Nenhum cartão é processado ou armazenado pelo painel.</p></div>}
        {activeTab === 'settings' && <div className="settings-section"><h2>⚙️ Configurações</h2><div className="settings-grid"><div className="setting-card"><h3>🔐 Alterar senha administrativa</h3><p>Como você já está autenticado como administrador, não é necessário informar a senha antiga.</p><form onSubmit={changePassword} style={{ display: 'grid', gap: 12, marginTop: 16 }}><input type="password" placeholder="Nova senha (mín. 8 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc' }} /><input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc' }} /><button type="submit" className="btn-submit" disabled={changingPassword}>{changingPassword ? '⏳ Alterando...' : '🔑 Alterar senha'}</button></form></div><div className="setting-card"><h3>🛡️ Segurança</h3><p>O acesso administrativo é protegido por token e validação do perfil no servidor.</p></div><div className="setting-card"><h3>📋 Auditoria</h3><p>A aprovação registra data e administrador responsável.</p></div></div></div>}
      </div>
    </div>
  );
}
export default AdminDashboard;
