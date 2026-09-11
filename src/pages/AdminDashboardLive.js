/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { BACKEND_URL } from '../config';
import '../styles/PrecoFixo17Reference.css';

const EMPTY_TOTALS = {
  passengers: 0,
  drivers: 0,
  approvedDrivers: 0,
  pendingDrivers: 0,
  rejectedDrivers: 0,
  onlineDrivers: 0,
  ridesToday: 0,
  activeRides: 0,
  completedToday: 0,
  cancelledToday: 0,
  revenueToday: 0,
  daily: [],
};

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function formatStatus(status) {
  const map = {
    SEARCHING: 'Procurando motorista',
    ACCEPTED: 'Aceita',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
    approved: 'Aprovado',
    pending: 'Pendente',
    rejected: 'Reprovado',
  };
  return map[status] || status || '—';
}

function statusClass(status) {
  if (/COMPLETED|approved|ATIVO|Online/i.test(String(status))) return 'concluida';
  if (/SEARCHING|ACCEPTED|IN_PROGRESS|pending/i.test(String(status))) return 'andamento';
  return 'cancelada';
}

function ActionButton({ children, onClick, disabled = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ border: '1px solid #2a313c', borderRadius: 10, padding: '9px 12px', background: disabled ? '#171a1f' : '#13171d', color: disabled ? '#677180' : '#fff', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

export default function AdminDashboardLive({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('painel');
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverApplications, setDriverApplications] = useState([]);
  const [approvalBusy, setApprovalBusy] = useState('');
  const [rides, setRides] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [promoActive, setPromoActive] = useState(() => localStorage.getItem('pf17_admin_promo') !== 'off');
  const [maintenanceMode, setMaintenanceMode] = useState(() => localStorage.getItem('pf17_admin_maintenance') === 'on');
  const [savedMessage, setSavedMessage] = useState('');
  const [readReviews, setReadReviews] = useState(() => new Set());

  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadDashboard = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, dataResponse, applicationsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin-stats/overview`, { headers: authHeaders, cache: 'no-store' }),
        fetch(`${BACKEND_URL}/api/admin-stats/data`, { headers: authHeaders, cache: 'no-store' }),
        fetch(`${BACKEND_URL}/api/drivers/applications`, { headers: authHeaders, cache: 'no-store' }),
      ]);
      const overview = await overviewResponse.json().catch(() => ({}));
      const data = await dataResponse.json().catch(() => ({}));
      const applicationsData = await applicationsResponse.json().catch(() => ({}));
      if (!applicationsResponse.ok) throw new Error(applicationsData.error || 'Não foi possível carregar os cadastros de motoristas.');
      if (!overviewResponse.ok) throw new Error(overview.error || 'Não foi possível carregar o painel.');
      if (!dataResponse.ok) throw new Error(data.error || 'Não foi possível carregar os dados administrativos.');
      const liveTotals = overview.totals || EMPTY_TOTALS;
      setTotals({ ...EMPTY_TOTALS, ...liveTotals });
      setUsers(Array.isArray(data.users) ? data.users : []);
      setDrivers(Array.isArray(data.drivers) ? data.drivers : []);
      setDriverApplications(Array.isArray(applicationsData.applications) ? applicationsData.applications : []);
      setRides(Array.isArray(data.rides) ? data.rides : []);
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (loadError) {
      setError(loadError.message || 'Erro ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const safeLogout = () => {
    try {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
    } catch (_) {}
    try { onLogout?.(); } catch (_) {}
    window.location.assign('/?loggedOut=1');
  };

  const saveSettings = () => {
    localStorage.setItem('pf17_admin_promo', promoActive ? 'on' : 'off');
    localStorage.setItem('pf17_admin_maintenance', maintenanceMode ? 'on' : 'off');
    setSavedMessage('Configurações salvas neste dispositivo.');
    window.setTimeout(() => setSavedMessage(''), 2500);
  };

  const exportReport = () => {
    const header = ['ID', 'Passageiro', 'Motorista', 'Origem', 'Destino', 'Valor', 'Status', 'Data'];
    const rows = rides.map((ride) => [ride.id, ride.passengerName, ride.driverName, ride.origin, ride.destination, money(ride.price), formatStatus(ride.status), new Date(Number(ride.createdAt) || Date.now()).toLocaleString('pt-BR')]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'precofixo17-relatorio-corridas.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const updateDriverApproval = async (driverId, status, reviewReason = '') => {
    if (!driverId || !['approved', 'rejected'].includes(status) || approvalBusy) return;
    setApprovalBusy(driverId);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/drivers/${encodeURIComponent(driverId)}/approval`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewReason: String(reviewReason || '').trim().slice(0, 500) }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a aprovação.');
      await loadDashboard();
      setSelected(null);
    } catch (approvalError) {
      setError(approvalError.message || 'Erro ao atualizar a aprovação.');
    } finally {
      setApprovalBusy('');
    }
  };

  const toggleReview = (id) => setReadReviews((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const nav = [
    ['painel', '📊', 'Painel'], ['usuarios', '👥', 'Usuários'], ['motoristas', '🚗', 'Motoristas'], ['corridas', '🗺️', 'Corridas'],
    ['pagamentos', '💳', 'Pagamentos'], ['promocoes', '🎁', 'Promoções'], ['avaliacoes', '⭐', 'Avaliações'], ['notificacoes', '🔔', 'Notificações'], ['relatorios', '📈', 'Relatórios'], ['configuracoes', '⚙️', 'Configurações']
  ];

  const renderPanel = () => {
    if (loading) return <div className="pf-admin-chart-card"><b>Carregando dados reais do Firebase…</b></div>;
    if (error) return <div className="pf-admin-chart-card"><div style={{ color: '#ef4444', fontWeight: 800 }}>{error}</div><div style={{ marginTop: 12 }}><ActionButton onClick={() => void loadDashboard()}>Tentar novamente</ActionButton></div></div>;

    if (activeTab === 'pagamentos') {
      return <div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Pagamentos</div><p style={{ color: '#8e98a5', lineHeight: 1.6 }}>A área de pagamentos está desativada temporariamente, conforme configurado para esta fase do projeto.</p></div>;
    }

    if (activeTab === 'usuarios') return (
      <div className="pf-admin-table-card"><div className="pf-admin-chart-title">Usuários reais</div><div style={{ overflowX: 'auto' }}><table className="pf-admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>{users.map((item) => <tr key={item.uid}><td style={{ fontWeight: 800 }}>{item.name}</td><td>{item.email || '—'}</td><td>{item.role}</td><td><span className={`pf-admin-status-badge ${statusClass(item.status)}`}>{item.status}</span></td><td><ActionButton onClick={() => setSelected({ title: 'Usuário', data: item })}>Ver detalhes</ActionButton></td></tr>)}</tbody></table></div></div>
    );

    if (activeTab === 'motoristas') {
      const pendingApplications = driverApplications.filter((item) => item.status === 'pending');
      return (
        <div className="pf-admin-table-card" data-admin-driver-approval="v1">
          <div className="pf-admin-chart-title">Cadastros de motoristas</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className="pf-admin-status-badge andamento">{pendingApplications.length} pendente(s)</span>
            <span className="pf-admin-status-badge concluida">{totals.approvedDrivers} aprovado(s)</span>
            <span className="pf-admin-status-badge cancelada">{totals.rejectedDrivers} rejeitado(s)</span>
          </div>
          {pendingApplications.length === 0 ? (
            <div style={{ padding: 20, border: '1px solid #222831', borderRadius: 12, color: '#9aa4b2' }}>Nenhum cadastro pendente de aprovação.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {pendingApplications.map((item) => (
                <div key={item.uid} style={{ border: '1px solid #2a313c', borderRadius: 14, padding: 16, background: '#101318' }}>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{item.fullName || 'Motorista'}</div>
                    <div style={{ color: '#aab3bf', fontSize: 13 }}>{item.email || '—'} • {item.phone || '—'}</div>
                    <div style={{ color: '#fff', marginTop: 6, fontWeight: 700 }}>{item.vehicleModel || 'Veículo não informado'}{item.licensePlate ? ' • ' + item.licensePlate : ''}</div>
                    <div style={{ color: '#aab3bf', fontSize: 13 }}>{item.city || '—'}{item.state ? ' / ' + item.state : ''} • {item.documentCount || 0} documentos</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    <ActionButton onClick={() => setSelected({ title: 'Cadastro de motorista', data: item })}>Ver cadastro</ActionButton>
                    <ActionButton disabled={approvalBusy === item.uid} onClick={() => { const reason = window.prompt('Motivo da aprovação (opcional):', 'Documentos validados com sucesso'); void updateDriverApproval(item.uid, 'approved', reason); }}>{approvalBusy === item.uid ? 'Processando…' : '✅ Aprovar'}</ActionButton>
                    <ActionButton disabled={approvalBusy === item.uid} onClick={() => { const reason = window.prompt('Motivo da rejeição:', 'Documentação precisa ser corrigida'); if (reason === null) return; void updateDriverApproval(item.uid, 'rejected', reason); }}>{approvalBusy === item.uid ? 'Processando…' : '❌ Rejeitar'}</ActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 22, overflowX: 'auto' }}>
            <table className="pf-admin-table"><thead><tr><th>Motorista</th><th>Veículo</th><th>Operação</th><th>Aprovação</th><th>Ação</th></tr></thead><tbody>
              {drivers.map((item) => <tr key={item.uid}><td style={{ fontWeight: 800 }}>{item.name}</td><td>{item.vehicle}{item.plate ? ' • ' + item.plate : ''}</td><td><span className={`pf-admin-status-badge ${statusClass(item.status)}`}>{item.status}</span></td><td><span className={`pf-admin-status-badge ${statusClass(item.approvalStatus)}`}>{formatStatus(item.approvalStatus)}</span></td><td><ActionButton onClick={() => { const application = driverApplications.find((candidate) => candidate.uid === item.uid); setSelected({ title: 'Motorista', data: application || item }); }}>Ver detalhes</ActionButton></td></tr>)}
            </tbody></table>
          </div>
        </div>
      );
    }
    if (activeTab === 'corridas') return (
      <div className="pf-admin-table-card"><div className="pf-admin-chart-title">Corridas reais</div><div style={{ overflowX: 'auto' }}><table className="pf-admin-table"><thead><tr><th>ID</th><th>Passageiro</th><th>Motorista</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead><tbody>{rides.map((ride) => <tr key={ride.id}><td style={{ fontWeight: 800 }}>{String(ride.id).slice(0, 12)}</td><td>{ride.passengerName}</td><td>{ride.driverName}</td><td style={{ fontWeight: 800 }}>{money(ride.price)}</td><td><span className={`pf-admin-status-badge ${statusClass(ride.status)}`}>{formatStatus(ride.status)}</span></td><td>{new Date(Number(ride.createdAt) || Date.now()).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></div>
    );

    if (activeTab === 'avaliacoes') return (
      <div className="pf-admin-table-card"><div className="pf-admin-chart-title">Avaliações reais</div><div style={{ overflowX: 'auto' }}><table className="pf-admin-table"><thead><tr><th>Nota</th><th>Comentário</th><th>Corrida</th><th>Data</th><th>Ação</th></tr></thead><tbody>{reviews.map((item) => <tr key={item.id}><td>★ {item.score}</td><td>{item.comment || 'Sem comentário'}</td><td>{item.rideId || '—'}</td><td>{new Date(Number(item.createdAt) || Date.now()).toLocaleString('pt-BR')}</td><td><ActionButton onClick={() => toggleReview(item.id)}>{readReviews.has(item.id) ? 'Marcar nova' : 'Marcar revisada'}</ActionButton></td></tr>)}</tbody></table></div></div>
    );

    if (activeTab === 'notificacoes') return (
      <div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Central administrativa</div><div style={{ display: 'grid', gap: 12 }}><div className="pf-admin-table-card"><b>{totals.pendingDrivers}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>motoristas pendentes de aprovação</div></div><div className="pf-admin-table-card"><b>{totals.activeRides}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>corridas ativas agora</div></div><div className="pf-admin-table-card"><b>{totals.onlineDrivers}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>motoristas online</div></div></div></div>
    );

    if (activeTab === 'promocoes') return (
      <div className="pf-admin-charts-grid"><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Promoção</div><div style={{ fontSize: 30, fontWeight: 900 }}>BEMVINDO17</div><p style={{ color: '#8e98a5', lineHeight: 1.5 }}>Controle local da promoção enquanto o módulo promocional de servidor não estiver conectado.</p><ActionButton onClick={() => setPromoActive((value) => !value)}>{promoActive ? 'Desativar promoção' : 'Ativar promoção'}</ActionButton><div style={{ marginTop: 14 }}><span className={`pf-admin-status-badge ${promoActive ? 'concluida' : 'cancelada'}`}>{promoActive ? 'Ativa' : 'Inativa'}</span></div></div></div>
    );

    if (activeTab === 'relatorios') return (
      <div className="pf-admin-charts-grid"><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Relatório real</div><p style={{ color: '#8e98a5', lineHeight: 1.5 }}>Exporta as corridas atualmente carregadas do Firebase.</p><ActionButton onClick={exportReport}>⬇ Exportar CSV</ActionButton></div><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Resumo</div><div style={{ display: 'grid', gap: 10 }}><span>Corridas hoje: <b>{totals.ridesToday}</b></span><span>Concluídas: <b>{totals.completedToday}</b></span><span>Canceladas: <b>{totals.cancelledToday}</b></span><span>Valor concluído hoje: <b>{money(totals.revenueToday)}</b></span></div></div></div>
    );

    if (activeTab === 'configuracoes') return (
      <div className="pf-admin-charts-grid"><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Configurações</div><label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid #1c2128' }}><span><b>Modo manutenção</b><small style={{ display: 'block', color: '#8e98a5', marginTop: 4 }}>Preferência operacional deste navegador.</small></span><input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} /></label><div style={{ paddingTop: 16 }}><ActionButton onClick={saveSettings}>Salvar configurações</ActionButton></div>{savedMessage && <div style={{ marginTop: 12, color: '#22c55e', fontWeight: 700 }}>{savedMessage}</div>}</div><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Sessão</div><div style={{ color: '#8e98a5' }}>Administrador: <b style={{ color: '#fff' }}>{admin?.name || 'Administrador'}</b></div><div style={{ marginTop: 12 }}><span className="pf-admin-status-badge concluida">Sessão ativa</span></div></div></div>
    );

    const maxDaily = Math.max(1, ...(totals.daily || []).map((item) => Number(item.rides) || 0));
    return <>
      <div className="pf-admin-metrics-grid">
        {[
          ['Passageiros', totals.passengers], ['Motoristas', totals.drivers], ['Corridas hoje', totals.ridesToday], ['Concluídas hoje', totals.completedToday],
          ['Corridas ativas', totals.activeRides], ['Motoristas online', totals.onlineDrivers], ['Pendentes', totals.pendingDrivers], ['Valor hoje', money(totals.revenueToday)]
        ].map(([label, value]) => <div className="pf-admin-metric-card" key={label}><div className="pf-admin-metric-label">{label}</div><div className="pf-admin-metric-val">{value}</div><div className="pf-admin-metric-trend">Dados reais</div></div>)}
      </div>
      <div className="pf-admin-charts-grid"><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Corridas nos últimos 7 dias</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, alignItems: 'end', minHeight: 180 }}>{(totals.daily || []).map((item) => { const h = Math.max(6, Math.round(((Number(item.rides) || 0) / maxDaily) * 140)); return <div key={item.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><div style={{ width: '100%', height: h, maxWidth: 46, borderRadius: 8, background: '#ff5a00', opacity: 0.9 }} title={`${item.rides} corridas`} /><span style={{ fontSize: 10, color: '#728096' }}>{item.date.slice(5)}</span></div>; })}</div></div><div className="pf-admin-chart-card"><div className="pf-admin-chart-title">Status</div><div style={{ display: 'grid', gap: 12, color: '#d5dbe4' }}><span>🟢 Concluídas: <b>{totals.completedToday}</b></span><span>🔴 Canceladas: <b>{totals.cancelledToday}</b></span><span>🟠 Ativas: <b>{totals.activeRides}</b></span></div></div></div>
      <div className="pf-admin-table-card"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}><div className="pf-admin-chart-title" style={{ marginBottom: 0 }}>Últimas corridas reais</div><ActionButton onClick={() => void loadDashboard()}>↻ Atualizar</ActionButton></div><div style={{ overflowX: 'auto' }}><table className="pf-admin-table"><thead><tr><th>ID</th><th>Passageiro</th><th>Motorista</th><th>Valor</th><th>Status</th></tr></thead><tbody>{rides.slice(0, 12).map((ride) => <tr key={ride.id}><td style={{ fontWeight: 800 }}>{String(ride.id).slice(0, 12)}</td><td>{ride.passengerName}</td><td>{ride.driverName}</td><td>{money(ride.price)}</td><td><span className={`pf-admin-status-badge ${statusClass(ride.status)}`}>{formatStatus(ride.status)}</span></td></tr>)}</tbody></table></div></div>
    </>;
  };

  return (
    <div className="pf-admin-screen">
      <style>{`.pf-admin-screen{min-height:100vh;background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}.pf-admin-topbar{height:60px;background:#0d0f13;border-bottom:1px solid #1c2128;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:100}.pf-admin-brand{font-size:18px;font-weight:900;font-style:italic}.pf-admin-brand b{color:#ff5a00}.pf-admin-brand small{color:#8e98a5;font-size:11px;font-style:normal;margin-left:8px;font-weight:700;letter-spacing:.1em}.pf-admin-user{display:flex;align-items:center;gap:12px}.pf-admin-name{font-size:14px;font-weight:700}.pf-admin-avatar{width:36px;height:36px;border-radius:50%;background:#ff5a00;display:flex;align-items:center;justify-content:center;font-weight:800}.pf-admin-layout{display:flex;flex:1}.pf-admin-sidebar{width:230px;background:#090b0e;border-right:1px solid #1c2128;padding:20px 12px;display:flex;flex-direction:column;gap:4px}.pf-admin-nav-item{display:flex;align-items:center;gap:12px;padding:11px 16px;border-radius:12px;color:#a4b0bf;font-size:14px;font-weight:600;background:transparent;border:none;cursor:pointer;text-align:left}.pf-admin-nav-item.active{background:#ff5a00;color:#fff;font-weight:800}.pf-admin-nav-item.logout{margin-top:auto;color:#ef4444}.pf-admin-content{flex:1;padding:24px;overflow-y:auto;max-width:1200px}.pf-admin-metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}.pf-admin-metric-card,.pf-admin-chart-card,.pf-admin-table-card{background:#0f1216;border:1px solid #222832;border-radius:18px;padding:20px}.pf-admin-metric-label{color:#8e98a5;font-size:13px;font-weight:600;margin-bottom:8px}.pf-admin-metric-val{font-size:24px;font-weight:900;line-height:1.15;margin-bottom:8px}.pf-admin-metric-trend{font-size:12px;font-weight:700;color:#22c55e}.pf-admin-charts-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px}.pf-admin-chart-title{font-size:16px;font-weight:800;margin-bottom:16px}.pf-admin-table{width:100%;border-collapse:collapse;font-size:13px}.pf-admin-table th{text-align:left;color:#7b8696;font-size:11px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid #222832}.pf-admin-table td{padding:14px 12px;border-bottom:1px solid #181d24;color:#e2e8f0}.pf-admin-status-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800}.pf-admin-status-badge.concluida{background:rgba(34,197,94,.12);color:#22c55e}.pf-admin-status-badge.andamento{background:rgba(255,90,0,.12);color:#ff5a00}.pf-admin-status-badge.cancelada{background:rgba(239,68,68,.12);color:#ef4444}@media(max-width:900px){.pf-admin-metrics-grid{grid-template-columns:repeat(2,1fr)}.pf-admin-charts-grid{grid-template-columns:1fr}.pf-admin-sidebar{display:none}.pf-admin-content{padding:14px}}`}</style>
      <header className="pf-admin-topbar"><div className="pf-admin-brand"><span>PREÇO </span><b>FIXO 17</b><small>PAINEL ADMIN</small></div><div className="pf-admin-user"><span className="pf-admin-name">{admin?.name || 'Administrador'}</span><div className="pf-admin-avatar">AD</div></div></header>
      <div className="pf-admin-layout"><aside className="pf-admin-sidebar">{nav.map(([id, icon, label]) => <button key={id} type="button" className={`pf-admin-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}><span>{icon}</span><span>{label}</span></button>)}<button type="button" className="pf-admin-nav-item logout" onClick={safeLogout}><span>🚪</span><span>Sair</span></button></aside><main className="pf-admin-content">{renderPanel()}</main></div>
      {selected && <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}><section onClick={(e) => e.stopPropagation()} style={{ width:'100%', maxWidth:520, background:'#0f1216', border:'1px solid #2a313c', borderRadius:20, padding:20, color:'#fff' }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}><h3 style={{ margin:0 }}>{selected.title}</h3><button type="button" onClick={() => setSelected(null)} style={{ border:0, background:'#1a1f26', color:'#fff', width:36, height:36, borderRadius:'50%', cursor:'pointer' }}>×</button></div><pre style={{ margin:0, whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#b9c2cf', fontFamily:'inherit', lineHeight:1.5 }}>{JSON.stringify(selected.data, null, 2)}</pre></section></div>}
    </div>
  );
}
