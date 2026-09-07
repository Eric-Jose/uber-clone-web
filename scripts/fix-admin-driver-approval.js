const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'pages', 'AdminDashboardLive.js');
let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('data-admin-driver-approval="v1"')) {
  console.log('[fix-admin-driver-approval] Workflow already present.');
  process.exit(0);
}

const stateNeedle = "  const [drivers, setDrivers] = useState([]);\n";
const stateInsert = `${stateNeedle}  const [driverApplications, setDriverApplications] = useState([]);\n  const [approvalBusy, setApprovalBusy] = useState('');\n`;
if (!source.includes(stateNeedle)) throw new Error('AdminDashboardLive: state anchor not found.');
source = source.replace(stateNeedle, stateInsert);

const requestNeedle = "      const [overviewResponse, dataResponse] = await Promise.all([\n        fetch(`${BACKEND_URL}/api/admin-stats/overview`, { headers: authHeaders, cache: 'no-store' }),\n        fetch(`${BACKEND_URL}/api/admin-stats/data`, { headers: authHeaders, cache: 'no-store' }),\n      ]);\n      const overview = await overviewResponse.json().catch(() => ({}));\n      const data = await dataResponse.json().catch(() => ({}));\n";
const requestInsert = "      const [overviewResponse, dataResponse, applicationsResponse] = await Promise.all([\n        fetch(`${BACKEND_URL}/api/admin-stats/overview`, { headers: authHeaders, cache: 'no-store' }),\n        fetch(`${BACKEND_URL}/api/admin-stats/data`, { headers: authHeaders, cache: 'no-store' }),\n        fetch(`${BACKEND_URL}/api/drivers/applications`, { headers: authHeaders, cache: 'no-store' }),\n      ]);\n      const overview = await overviewResponse.json().catch(() => ({}));\n      const data = await dataResponse.json().catch(() => ({}));\n      const applicationsData = await applicationsResponse.json().catch(() => ({}));\n      if (!applicationsResponse.ok) throw new Error(applicationsData.error || 'Não foi possível carregar os cadastros de motoristas.');\n";
if (!source.includes(requestNeedle)) throw new Error('AdminDashboardLive: load anchor not found.');
source = source.replace(requestNeedle, requestInsert);

const driversNeedle = "      setDrivers(Array.isArray(data.drivers) ? data.drivers : []);\n";
const driversInsert = `${driversNeedle}      setDriverApplications(Array.isArray(applicationsData.applications) ? applicationsData.applications : []);\n`;
if (!source.includes(driversNeedle)) throw new Error('AdminDashboardLive: drivers state anchor not found.');
source = source.replace(driversNeedle, driversInsert);

const handlerNeedle = "  const toggleReview = (id) => setReadReviews((current) => {\n";
const handlerInsert = `  const updateDriverApproval = async (driverId, status, reviewReason = '') => {\n    if (!driverId || !['approved', 'rejected'].includes(status) || approvalBusy) return;\n    setApprovalBusy(driverId);\n    setError('');\n    try {\n      const response = await fetch(\`${BACKEND_URL}/api/drivers/${encodeURIComponent(driverId)}/approval\`, {\n        method: 'PATCH',\n        headers: { ...authHeaders, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ status, reviewReason: String(reviewReason || '').trim().slice(0, 500) }),\n        cache: 'no-store',\n      });\n      const data = await response.json().catch(() => ({}));\n      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a aprovação.');\n      await loadDashboard();\n      setSelected(null);\n    } catch (approvalError) {\n      setError(approvalError.message || 'Erro ao atualizar a aprovação.');\n    } finally {\n      setApprovalBusy('');\n    }\n  };\n\n${handlerNeedle}`;
if (!source.includes(handlerNeedle)) throw new Error('AdminDashboardLive: handler anchor not found.');
source = source.replace(handlerNeedle, handlerInsert);

const motoristasStart = "    if (activeTab === 'motoristas') return (\n";
const corridasStart = "\n    if (activeTab === 'corridas') return (\n";
const start = source.indexOf(motoristasStart);
const end = source.indexOf(corridasStart, start);
if (start < 0 || end < 0) throw new Error('AdminDashboardLive: motoristas panel boundaries not found.');

const approvalPanel = `    if (activeTab === 'motoristas') {\n      const pendingApplications = driverApplications.filter((item) => item.status === 'pending');\n      return (\n        <div className="pf-admin-table-card" data-admin-driver-approval="v1">\n          <div className="pf-admin-chart-title">Cadastros de motoristas</div>\n          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>\n            <span className="pf-admin-status-badge andamento">{pendingApplications.length} pendente(s)</span>\n            <span className="pf-admin-status-badge concluida">{totals.approvedDrivers} aprovado(s)</span>\n            <span className="pf-admin-status-badge cancelada">{totals.rejectedDrivers} rejeitado(s)</span>\n          </div>\n          {pendingApplications.length === 0 ? (\n            <div style={{ padding: 20, border: '1px solid #222831', borderRadius: 12, color: '#9aa4b2' }}>Nenhum cadastro pendente de aprovação.</div>\n          ) : (\n            <div style={{ display: 'grid', gap: 12 }}>\n              {pendingApplications.map((item) => (\n                <div key={item.uid} style={{ border: '1px solid #2a313c', borderRadius: 14, padding: 16, background: '#101318' }}>\n                  <div style={{ display: 'grid', gap: 5 }}>\n                    <div style={{ fontWeight: 900, fontSize: 18 }}>{item.fullName || 'Motorista'}</div>\n                    <div style={{ color: '#aab3bf', fontSize: 13 }}>{item.email || '—'} • {item.phone || '—'}</div>\n                    <div style={{ color: '#fff', marginTop: 6, fontWeight: 700 }}>{item.vehicleModel || 'Veículo não informado'}{item.licensePlate ? ` • ${item.licensePlate}` : ''}</div>\n                    <div style={{ color: '#aab3bf', fontSize: 13 }}>{item.city || '—'}{item.state ? ` / ${item.state}` : ''} • {item.documentCount || 0} documentos</div>\n                  </div>\n                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>\n                    <ActionButton onClick={() => setSelected({ title: 'Cadastro de motorista', data: item })}>Ver cadastro</ActionButton>\n                    <ActionButton disabled={approvalBusy === item.uid} onClick={() => { const reason = window.prompt('Motivo da aprovação (opcional):', 'Documentos validados com sucesso'); void updateDriverApproval(item.uid, 'approved', reason); }}>✅ Aprovar</ActionButton>\n                    <ActionButton disabled={approvalBusy === item.uid} onClick={() => { const reason = window.prompt('Motivo da rejeição:', 'Documentação precisa ser corrigida'); if (reason === null) return; void updateDriverApproval(item.uid, 'rejected', reason); }}>❌ Rejeitar</ActionButton>\n                  </div>\n                </div>\n              ))}\n            </div>\n          )}\n          <div style={{ marginTop: 22, overflowX: 'auto' }}>\n            <table className="pf-admin-table"><thead><tr><th>Motorista</th><th>Veículo</th><th>Operação</th><th>Aprovação</th><th>Ação</th></tr></thead><tbody>\n              {drivers.map((item) => <tr key={item.uid}><td style={{ fontWeight: 800 }}>{item.name}</td><td>{item.vehicle}{item.plate ? ` • ${item.plate}` : ''}</td><td><span className={\`pf-admin-status-badge \${statusClass(item.status)}\`}>{item.status}</span></td><td><span className={\`pf-admin-status-badge \${statusClass(item.approvalStatus)}\`}>{formatStatus(item.approvalStatus)}</span></td><td><ActionButton onClick={() => { const application = driverApplications.find((candidate) => candidate.uid === item.uid); setSelected({ title: 'Motorista', data: application || item }); }}>Ver detalhes</ActionButton></td></tr>)}\n            </tbody></table>\n          </div>\n        </div>\n      );\n    }\n`;
source = source.slice(0, start) + approvalPanel + source.slice(end);

fs.writeFileSync(appPath, source, 'utf8');
console.log('[fix-admin-driver-approval] ADM conectado ao cadastro real de motoristas: listar, visualizar, aprovar e rejeitar.');
