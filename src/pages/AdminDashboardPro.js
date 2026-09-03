import React, { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL as B } from '../config';

const css = `
.ad{min-height:100vh;background:#f3f4f6;padding:20px;font-family:Arial}
.ac{max-width:1100px;margin:0 auto 16px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 4px 18px #0001}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{padding:15px;border-radius:14px;background:#f5f6f7}
.metric b{display:block;font-size:12px;color:#6b7280}.metric strong{font-size:26px;display:block;margin-top:5px}
.table{width:100%;border-collapse:collapse}.table th,.table td{padding:10px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
.btn{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}
.yes{background:#16a34a;color:#fff}.no{background:#dc2626;color:#fff}.dark{background:#111827;color:#fff}
.muted{color:#6b7280;font-size:13px}.ok{color:#15803d}.error{background:#fff1f2;color:#9f1239;padding:10px 12px;border-radius:10px}
.chart{display:flex;align-items:flex-end;gap:8px;height:160px}.bar{flex:1;background:#111;border-radius:7px 7px 0 0;min-width:8px}
.scroll{overflow:auto}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:6px}
@media(max-width:800px){.cards{grid-template-columns:1fr 1fr}.table{min-width:760px}}
@media(max-width:500px){.ad{padding:10px}.cards{grid-template-columns:1fr}}
`;

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error(`O servidor retornou uma resposta inválida (${response.status}).`); }
}

export default function AdminDashboardPro({ admin, onLogout }) {
  const [data, setData] = useState(null);
  const [apps, setApps] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);

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
      setData(overviewData); setMsg('');
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
  return (
    <div className="ad"><style>{css}</style>
      <div className="ac"><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div><h1 style={{margin:0}}>🔐 Painel administrativo</h1><div className="muted"><span className="status-dot" />{admin?.name || admin?.email || 'Administrador'} • dados atualizados automaticamente</div></div><button className="btn no" onClick={onLogout}>Sair</button></div>{msg && <p className={msg.toLowerCase().includes('sucesso') ? 'ok' : 'error'}>{msg}</p>}</div>
      <div className="ac"><div className="cards">{[['Passageiros',t.passengers],['Motoristas',t.drivers],['Online',t.onlineDrivers],['Corridas hoje',t.ridesToday],['Ativas',t.activeRides],['Concluídas',t.completedToday],['Canceladas',t.cancelledToday],['Receita hoje',`R$ ${Number(t.revenueToday||0).toFixed(2)}`]].map(([name,value])=><div className="metric" key={name}><b>{name}</b><strong>{value ?? (loading?'…':'—')}</strong></div>)}</div></div>
      {data?.daily && <div className="ac"><h2>📈 Últimos 7 dias</h2><div className="chart">{data.daily.map(day=><div key={day.date} title={`${day.date}: ${day.rides} corridas`} className="bar" style={{height:`${Math.max(8,Math.min(150,day.rides*14))}px`}} />)}</div><div className="muted">Cada coluna representa a quantidade de corridas do dia.</div></div>}
      <div className="ac"><h2>🚗 Cadastros de motoristas</h2>{!apps.length?<p className="muted">{loading?'Carregando cadastros…':'Nenhum cadastro encontrado.'}</p>:<div className="scroll"><table className="table"><thead><tr><th>Motorista</th><th>Contato</th><th>Veículo</th><th>Status</th><th>Ação</th></tr></thead><tbody>{apps.map(application=><tr key={application.uid}><td><b>{application.fullName||'Sem nome'}</b></td><td>{application.email}<br/>{application.phone}</td><td>{application.vehicleModel||'—'}<br/>{application.licensePlate||'—'}</td><td>{application.status}</td><td>{application.status==='pending'?<><button className="btn yes" disabled={!!reviewing} onClick={()=>review(application.uid,'approved')}>{reviewing===`${application.uid}:approved`?'Aprovando…':'Aprovar'}</button>{' '}<button className="btn no" disabled={!!reviewing} onClick={()=>review(application.uid,'rejected')}>{reviewing===`${application.uid}:rejected`?'Rejeitando…':'Rejeitar'}</button></>:<span className="muted">Revisado</span>}</td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}
