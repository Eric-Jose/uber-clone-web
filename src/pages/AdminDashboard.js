import React, { useEffect, useMemo, useState } from 'react';
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
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [onlineDrivers, setOnlineDrivers] = useState(0);
  const [overview, setOverview] = useState({
    passengers: 0, drivers: 0, approvedDrivers: 0, onlineDrivers: 0, ridesToday: 0,
    activeRides: 0, completedToday: 0, cancelledToday: 0, revenueToday: 0
  });
  const [daily, setDaily] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const getToken = () => localStorage.getItem('adminToken') || localStorage.getItem('token');

  const loadApplications = async () => {
    const token = getToken();
    if (!token) { setError('Sessão administrativa não encontrada. Faça login novamente.'); return; }
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/drivers/applications`, { headers: { Authorization: `Bearer ${token}` } });
      setApplications(Array.isArray(response.data?.applications) ? response.data.applications : []);
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível carregar os cadastros de motoristas.'); }
    finally { setLoading(false); }
  };

  const loadDashboardStats = async () => {
    const token = getToken();
    if (!token) return;
    setStatsLoading(true);
    try {
      const [statsResponse, onlineResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin-stats/overview`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }),
        axios.get(`${BACKEND_URL}/api/drivers/online-count`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
      ]);
      const totals = statsResponse.data?.totals || {};
      setOverview({
        passengers: Number(totals.passengers) || 0,
        drivers: Number(totals.drivers) || 0,
        approvedDrivers: Number(totals.approvedDrivers) || 0,
        onlineDrivers: Number(totals.onlineDrivers) || 0,
        ridesToday: Number(totals.ridesToday) || 0,
        activeRides: Number(totals.activeRides) || 0,
        completedToday: Number(totals.completedToday) || 0,
        cancelledToday: Number(totals.cancelledToday) || 0,
        revenueToday: Number(totals.revenueToday) || 0
      });
      setOnlineDrivers(Number(onlineResponse.data?.online) || Number(totals.onlineDrivers) || 0);
      setDaily(Array.isArray(statsResponse.data?.daily) ? statsResponse.data.daily : []);
    } catch (_) {
      // O painel mantém os últimos dados visíveis durante falhas momentâneas.
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    loadDashboardStats();
    const interval = setInterval(loadDashboardStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const statsFromApplications = useMemo(() => ({
    total: applications.length,
    pending: applications.filter((i) => i.status === 'pending').length,
    approved: applications.filter((i) => i.status === 'approved').length,
    rejected: applications.filter((i) => i.status === 'rejected').length
  }), [applications]);

  const reviewDriver = async (uid, status) => {
    const token = getToken(); if (!token) return;
    setActionUid(uid); setError(''); setSuccess('');
    try {
      await axios.patch(`${BACKEND_URL}/api/drivers/${uid}/approval`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(status === 'approved' ? 'Motorista aprovado com sucesso.' : 'Cadastro de motorista rejeitado.');
      await loadApplications();
      await loadDashboardStats();
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível atualizar a aprovação.'); }
    finally { setActionUid(null); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setPasswordError(''); setPasswordMessage('');
    if (newPassword.length < 8) { setPasswordError('A nova senha deve ter pelo menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('A confirmação da nova senha não confere.'); return; }
    const token = getToken();
    if (!token) { setPasswordError('Sessão administrativa não encontrada. Faça login novamente.'); return; }
    setChangingPassword(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/admin/set-password`, { newPassword }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const message = response.data?.message || 'Senha administrativa alterada com sucesso!';
      setNewPassword(''); setConfirmPassword(''); setPasswordMessage(message); setSuccess(message);
    } catch (err) {
      const message = err.response?.data?.error || 'Não foi possível alterar a senha.';
      setPasswordError(message); setError(message);
    } finally { setChangingPassword(false); }
  };

  const maskCpf = (cpf = '') => { const digits = String(cpf).replace(/\D/g, ''); if (digits.length !== 11) return cpf || '—'; return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`; };
  const maxDailyRides = Math.max(1, ...daily.map((item) => Number(item.rides) || 0));
  const maxDailyRevenue = Math.max(1, ...daily.map((item) => Number(item.revenue) || 0));

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
        {activeTab === 'overview' && <div className="overview-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><h2>📊 Visão Geral</h2><p className="section-description">Indicadores atualizados automaticamente.</p></div><span style={{ fontSize: 12, color: '#666' }}>{statsLoading ? 'Atualizando…' : '● Atualizado agora'}</span></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-info"><span className="stat-label">Passageiros</span><span className="stat-value">{overview.passengers}</span></div></div>
            <div className="stat-card"><div className="stat-icon">🚗</div><div className="stat-info"><span className="stat-label">Motoristas aprovados</span><span className="stat-value">{overview.approvedDrivers}</span></div></div>
            <div className="stat-card"><div className="stat-icon">🟢</div><div className="stat-info"><span className="stat-label">Motoristas online</span><span className="stat-value">{onlineDrivers}</span></div></div>
            <div className="stat-card"><div className="stat-icon">🚕</div><div className="stat-info"><span className="stat-label">Corridas hoje</span><span className="stat-value">{overview.ridesToday}</span></div></div>
            <div className="stat-card"><div className="stat-icon">🔄</div><div className="stat-info"><span className="stat-label">Corridas em andamento</span><span className="stat-value">{overview.activeRides}</span></div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><span className="stat-label">Concluídas hoje</span><span className="stat-value">{overview.completedToday}</span></div></div>
            <div className="stat-card"><div className="stat-icon">❌</div><div className="stat-info"><span className="stat-label">Canceladas hoje</span><span className="stat-value">{overview.cancelledToday}</span></div></div>
            <div className="stat-card"><div className="stat-icon">💰</div><div className="stat-info"><span className="stat-label">Faturamento hoje</span><span className="stat-value">R$ {overview.revenueToday.toFixed(2)}</span></div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginTop: 22 }}>
            <div className="setting-card"><h3>📈 Corridas — últimos 7 dias</h3><div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 10, paddingTop: 20 }}>{daily.map((item) => { const value = Number(item.rides) || 0; const height = `${Math.max(4, (value / maxDailyRides) * 170)}px`; const label = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : '—'; return <div key={item.date} style={{ flex: 1, minWidth: 20, textAlign: 'center' }}><div title={`${value} corridas`} style={{ height, background: '#111827', borderRadius: '8px 8px 2px 2px', minHeight: 4 }} /><div style={{ fontSize: 11, marginTop: 6, color: '#666' }}>{label}</div><strong style={{ fontSize: 12 }}>{value}</strong></div>; })}</div></div>
            <div className="setting-card"><h3>💵 Faturamento — últimos 7 dias</h3><div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 10, paddingTop: 20 }}>{daily.map((item) => { const value = Number(item.revenue) || 0; const height = `${Math.max(4, (value / maxDailyRevenue) * 170)}px`; const label = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : '—'; return <div key={item.date} style={{ flex: 1, minWidth: 20, textAlign: 'center' }}><div title={`R$ ${value.toFixed(2)}`} style={{ height, background: '#16a34a', borderRadius: '8px 8px 2px 2px', minHeight: 4 }} /><div style={{ fontSize: 11, marginTop: 6, color: '#666' }}>{label}</div><strong style={{ fontSize: 11 }}>R$ {value.toFixed(0)}</strong></div>; })}</div></div>
          </div>
          <div className="action-buttons" style={{ marginTop: 20 }}><button className="btn-action" onClick={() => { setActiveTab('drivers'); loadApplications(); }}>🔄 Atualizar cadastros</button></div>
        </div>}

        {activeTab === 'drivers' && <div className="drivers-section"><h2>🚗 Aprovação de Motoristas</h2><p className="section-description">Analise os cadastros enviados e aprove somente motoristas que cumprirem os requisitos.</p><div style={{ margin: '12px 0 18px', display: 'flex', gap: 10, flexWrap: 'wrap' }}><span>📋 {statsFromApplications.total} cadastros</span><span>⏳ {statsFromApplications.pending} pendentes</span><span>✅ {statsFromApplications.approved} aprovados</span><span>❌ {statsFromApplications.rejected} rejeitados</span></div>{loading ? <p>Carregando cadastros...</p> : applications.length === 0 ? <p className="empty-state">Nenhum cadastro encontrado.</p> : <div className="drivers-list">{applications.map((driver) => <div className="banner-item" key={driver.uid}><div className="banner-details"><h4>{driver.fullName || 'Motorista sem nome'}</h4><p>📧 {driver.email || '—'} · 📱 {driver.phone || '—'}</p><p>🪪 CPF: {maskCpf(driver.cpf)} · 🚘 {driver.vehicleModel || '—'} · Placa: {driver.licensePlate || '—'}</p><p>📄 {driver.documentCount || 0} documentos · Enviado: {driver.submittedAt ? new Date(driver.submittedAt).toLocaleString('pt-BR') : '—'}</p><strong>Status: {driver.status === 'pending' ? '⏳ Pendente' : driver.status === 'approved' ? '✅ Aprovado' : '❌ Rejeitado'}</strong></div>{driver.status === 'pending' && <div className="banner-actions"><button className="btn-submit" disabled={actionUid === driver.uid} onClick={() => reviewDriver(driver.uid, 'approved')}>{actionUid === driver.uid ? 'Aguarde...' : '✅ Aprovar'}</button><button className="btn-delete" disabled={actionUid === driver.uid} onClick={() => reviewDriver(driver.uid, 'rejected')}>❌ Rejeitar</button></div>}</div>)}</div>}</div>}
        {activeTab === 'finance' && <div className="finance-section"><h2>💰 Financeiro</h2><p className="section-description">Resumo automático das corridas concluídas. O faturamento exibido corresponde ao valor total das corridas concluídas no período.</p><div className="stats-grid" style={{ marginTop: 18 }}><div className="stat-card"><div className="stat-icon">💰</div><div className="stat-info"><span className="stat-label">Hoje</span><span className="stat-value">R$ {overview.revenueToday.toFixed(2)}</span></div></div><div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><span className="stat-label">Corridas concluídas</span><span className="stat-value">{overview.completedToday}</span></div></div></div></div>}
        {activeTab === 'settings' && <div className="settings-section"><h2>⚙️ Configurações</h2><div className="settings-grid"><div className="setting-card"><h3>🔐 Alterar senha administrativa</h3><p>Como você já está autenticado como administrador, não é necessário informar a senha antiga.</p><form onSubmit={changePassword} style={{ display: 'grid', gap: 12, marginTop: 16 }}><input type="password" placeholder="Nova senha (mín. 8 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc' }} /><input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc' }} /><button type="submit" className="btn-submit" disabled={changingPassword}>{changingPassword ? '⏳ Alterando...' : '🔑 Alterar senha'}</button>{passwordMessage && <div className="password-success">✅ {passwordMessage}</div>}{passwordError && <div className="password-error">❌ {passwordError}</div>}</form></div><div className="setting-card"><h3>🛡️ Segurança</h3><p>O acesso administrativo é protegido por token e validação do perfil no servidor.</p></div><div className="setting-card"><h3>📋 Auditoria</h3><p>A aprovação registra data e administrador responsável.</p></div></div></div>}
      </div>
    </div>
  );
}

export default AdminDashboard;
