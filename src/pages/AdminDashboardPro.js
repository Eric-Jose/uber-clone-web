import React, { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL as B } from '../config';

const css = `
.ad{min-height:100vh;background:#f3f4f6;padding:20px;font-family:Arial,sans-serif;color:#111827}
.ac{max-width:1180px;margin:0 auto 16px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 4px 18px #0001}
.header{display:flex;justify-content:space-between;gap:12px;align-items:center}.brand h1{margin:0;font-size:25px}.muted{color:#6b7280;font-size:13px;line-height:1.45}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:6px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{padding:15px;border-radius:14px;background:#f5f6f7;min-height:76px}.metric b{display:block;font-size:12px;color:#6b7280}.metric strong{font-size:26px;display:block;margin-top:5px}.metric small{display:block;margin-top:4px;color:#6b7280;font-size:11px}
.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-head h2{margin:0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.mini{padding:12px;border-radius:12px;background:#f5f6f7}.mini b{display:block;font-size:11px;color:#6b7280}.mini strong{font-size:20px;display:block;margin-top:4px}
.table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px 10px;border-bottom:1px solid #eee;text-align:left;font-size:13px;vertical-align:middle}.table th{color:#6b7280;font-size:11px;text-transform:uppercase}.scroll{overflow:auto}
.btn{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}.yes{background:#16a34a;color:#fff}.no{background:#dc2626;color:#fff}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800}.badge.pending{background:#fff7ed;color:#c2410c}.badge.approved{background:#ecfdf5;color:#15803d}.badge.rejected{background:#fef2f2;color:#b91c1c}.online{color:#15803d;font-weight:800}.offline{color:#6b7280;font-weight:700}
.ok{color:#15803d;background:#ecfdf5;padding:10px 12px;border-radius:10px}.error{background:#fff1f2;color:#9f1239;padding:10px 12px;border-radius:10px}.refresh{font-size:12px;color:#6b7280;margin-top:8px}
.chart{display:flex;align-items:flex-end;gap:8px;height:160px}.chart-item{flex:1;min-width:22px}.bar-wrap{height:160px;display:flex;align-items:flex-end}.bar{width:100%;background:#111;border-radius:7px 7px 0 0;min-height:8px}.bar-label{text-align:center;font-size:10px;color:#6b7280;margin-top:5px;white-space:nowrap;overflow:hidden}
@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.ad{padding:10px}.cards,.summary{grid-template-columns:1fr}.header{align-items:flex-start}.brand h1{font-size:21px}.table{min-width:820px}}
`;

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error(`O servidor retornou uma resposta inválida (${response.status}).`); }
}

function statusLabel(status) {
  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Rejeitado';
  return 'Pendente';
}

export default function AdminDashboardPro({ admin, onLogout }) {
  const [data, setData] = useState(null);
  const [apps, setApps] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async (silent = false) => {
    const token = localStorage.getItem('adminToken');
    if (!token) { onLogout(); return; }
    if (!silent) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [applicationsResponse, overviewResponse] = await Promise.all([
        fetch(`${B}/api/drivers/applications`, { headers, cache: 'no-store' }),
        fetch(`${B}/api/admin-stats/overview`, { headers, cache: 'no-store' })
      ]);
      if (applicationsResponse.status === 401 || overviewResponse.status === 401) {
        setMsg('Sua sessão administrativa expirou. Faça login novamente.'); onLogout(); return;
      }
      const applicationsData = await readJson(applicationsResponse);
      const overviewData = await readJson(overviewResponse);
      if (!applicationsResponse.ok || !overviewResponse.ok) {
        throw new Error(applicationsData.error || overviewData.error || `Falha ao carregar dados administrativos (${applicationsResponse.status}/${overviewResponse.status}).`);
      }
      setApps(Array.isArray(applicationsData.applications) ? applicationsData.applications : []);
      setData(overviewData);
      setLastUpdate(new Date());
      setMsg('');
    } catch (e) {
      setMsg(e.message || 'Não foi possível carregar os dados administrativos agora.');
    } finally { if (!silent) setLoading(false); }
  }, [onLogout]);

  useEffect(() => {
    let active = true;
    load();
    const id = window.setInterval(() => { if (active) load(true); }, 5000);
    return () => { active = false; window.clearInterval(id); };
  }, [load]);

  const review = async (uid, status) => {
    if (reviewing) return;
    const token = localStorage.getItem('adminToken');
    if (!token) { onLogout(); return; }
    setReviewing(`${uid}:${status}`); setMsg('');
    try {
      const response = await fetch(`${B}/api/drivers/${uid}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const result = await readJson(response);
      if (response.status === 401) { onLogout(); return; }
      if (!response.ok) throw new Error(result.error || 'Erro ao atualizar motorista.');
      setMsg(status === 'approved' ? 'Motorista aprovado com sucesso.' : status === 'rejected' ? 'Motorista rejeitado.' : 'Cadastro devolvido para análise.');
      await load(true);
    } catch (e) { setMsg(e.message || 'Não foi possível atualizar o motorista.'); }
    finally { setReviewing(null); }
  };

  const t = data?.totals || {};
  const pendingFromList = apps.filter((item) => item.status === 'pending').length;
  const approvedFromList = apps.filter((item) => item.status === 'approved').length;
  const rejectedFromList = apps.filter((item) => item.status === 'rejected').length;

  return (
    <div className="ad"><style>{css}</style>
      <div className="ac">
        <div className="header">
          <div className="brand"><h1>🔐 Painel administrativo</h1><div className="muted"><span className="status-dot" />{admin?.name || admin?.email || 'Administrador'} • acompanhamento em tempo real</div></div>
          <button className="btn no" onClick={onLogout}>Sair</button>
        </div>
        {msg && <p className={msg.includes('sucesso') ? 'ok' : 'error'}>{msg}</p>}
        <div className="refresh">{lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR')}` : (loading ? 'Carregando dados…' : 'Aguardando atualização')}</div>
      </div>

      <div className="ac">
        <div className="cards">
          <div className="metric"><b>Passageiros</b><strong>{t.passengers ?? (loading ? '…' : '—')}</strong><small>contas cadastradas</small></div>
          <div className="metric"><b>Motoristas cadastrados</b><strong>{t.drivers ?? (loading ? '…' : '—')}</strong><small>cadastros únicos</small></div>
          <div className="metric"><b>Motoristas online</b><strong>{t.onlineDrivers ?? (loading ? '…' : '—')}</strong><small>aprovados e online</small></div>
          <div className="metric"><b>Motoristas aprovados</b><strong>{t.approvedDrivers ?? (loading ? '…' : '—')}</strong><small>liberados para trabalhar</small></div>
          <div className="metric"><b>Cadastros pendentes</b><strong>{t.pendingDrivers ?? (loading ? '…' : '—')}</strong><small>aguardando análise</small></div>
          <div className="metric"><b>Corridas hoje</b><strong>{t.ridesToday ?? (loading ? '…' : '—')}</strong><small>solicitações do dia</small></div>
          <div className="metric"><b>Corridas ativas</b><strong>{t.activeRides ?? (loading ? '…' : '—')}</strong><small>em andamento agora</small></div>
          <div className="metric"><b>Receita hoje</b><strong>R$ {Number(t.revenueToday || 0).toFixed(2)}</strong><small>corridas concluídas hoje</small></div>
        </div>
      </div>

      <div className="ac">
        <div className="section-head"><h2>🚗 Resumo dos motoristas</h2><span className="muted">Mesma base da lista de cadastros</span></div>
        <div className="summary">
          <div className="mini"><b>Total na lista</b><strong>{apps.length}</strong></div>
          <div className="mini"><b>Pendentes</b><strong>{pendingFromList}</strong></div>
          <div className="mini"><b>Aprovados</b><strong>{approvedFromList}</strong></div>
          <div className="mini"><b>Rejeitados</b><strong>{rejectedFromList}</strong></div>
        </div>
      </div>

      {data?.daily && <div className="ac"><h2>📈 Últimos 7 dias</h2><div className="chart">{data.daily.map(day => <div className="chart-item" key={day.date}><div className="bar-wrap"><div title={`${day.date}: ${day.rides} corridas`} className="bar" style={{height:`${Math.max(8,Math.min(150,day.rides*14))}px`}} /></div><div className="bar-label">{new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</div></div>)}</div><div className="muted">Cada coluna representa a quantidade de corridas do dia.</div></div>}

      <div className="ac">
        <div className="section-head"><div><h2>📋 Cadastros de motoristas</h2><div className="muted">Os indicadores acima são atualizados junto com esta lista.</div></div></div>
        {!apps.length ? <p className="muted">{loading ? 'Carregando cadastros…' : 'Nenhum cadastro encontrado.'}</p> : <div className="scroll"><table className="table"><thead><tr><th>Motorista</th><th>Contato</th><th>Veículo</th><th>Status</th><th>Ação</th></tr></thead><tbody>{apps.map(application => <tr key={application.uid}>
          <td><b>{application.fullName || 'Sem nome'}</b></td>
          <td>{application.email}<br />{application.phone}</td>
          <td>{application.vehicleModel || '—'}<br />{application.licensePlate || '—'}</td>
          <td><span className={`badge ${application.status}`}>{statusLabel(application.status)}</span></td>
          <td>{application.status === 'pending' ? <><button className="btn yes" disabled={!!reviewing} onClick={() => review(application.uid,'approved')}>{reviewing === `${application.uid}:approved` ? 'Aprovando…' : 'Aprovar'}</button>{' '}<button className="btn no" disabled={!!reviewing} onClick={() => review(application.uid,'rejected')}>{reviewing === `${application.uid}:rejected` ? 'Rejeitando…' : 'Rejeitar'}</button></> : <span className={application.status === 'approved' ? 'online' : 'offline'}>{application.status === 'approved' ? 'Liberado' : 'Revisado'}</span>}</td>
        </tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
