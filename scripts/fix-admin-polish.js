const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/AdminDashboardLive.js');
if (!fs.existsSync(file)) throw new Error('AdminDashboardLive.js not found');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-admin-polish="v2"')) process.exit(0);

const mustHave = [
  "const [readReviews, setReadReviews] = useState",
  "const nav = [",
  "if (activeTab === 'usuarios')",
  "if (activeTab === 'corridas')",
  "if (activeTab === 'pagamentos')",
  "<main className=\"pf-admin-content\">",
];
for (const marker of mustHave) if (!source.includes(marker)) throw new Error(`Admin polish marker missing: ${marker}`);

source = source.replace(
  "  const [readReviews, setReadReviews] = useState(() => new Set());",
  "  const [readReviews, setReadReviews] = useState(() => new Set());\n  const [adminSearch, setAdminSearch] = useState('');\n  const normalizedSearch = adminSearch.trim().toLowerCase();\n  const filteredUsers = useMemo(() => normalizedSearch ? users.filter((item) => [item.name, item.email, item.role, item.status].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) : users, [users, normalizedSearch]);\n  const filteredDrivers = useMemo(() => normalizedSearch ? drivers.filter((item) => [item.name, item.email, item.vehicle, item.plate, item.status, item.approvalStatus].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) : drivers, [drivers, normalizedSearch]);\n  const filteredRides = useMemo(() => normalizedSearch ? rides.filter((item) => [item.id, item.passengerName, item.driverName, item.origin, item.destination, item.status].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) : rides, [rides, normalizedSearch]);\n  const filteredReviews = useMemo(() => normalizedSearch ? reviews.filter((item) => [item.id, item.rideId, item.comment, item.score].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) : reviews, [reviews, normalizedSearch]);"
);

source = source.replace("{users.map((item) =>", "{filteredUsers.map((item) =>");
source = source.replace("{drivers.map((item) =>", "{filteredDrivers.map((item) =>");
source = source.replace("{rides.map((ride) =>", "{filteredRides.map((ride) =>");
source = source.replace("{reviews.map((item) =>", "{filteredReviews.map((item) =>");
source = source.replace("driverApplications.filter((item) => item.status === 'pending')", "driverApplications.filter((item) => item.status === 'pending' && (!normalizedSearch || [item.fullName, item.email, item.phone, item.vehicleModel, item.licensePlate, item.city].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))))");

source = source.replace(
  "if (activeTab === 'pagamentos') {\n      return <div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Pagamentos</div><p style={{ color: '#8e98a5', lineHeight: 1.6 }}>A área de pagamentos está desativada temporariamente, conforme configurado para esta fase do projeto.</p></div>;\n    }",
  "if (activeTab === 'pagamentos') {\n      return <div className=\"pf-admin-charts-grid\"><div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Pagamentos</div><div className=\"pf-admin-metrics-grid pf-admin-mini-grid\"><div className=\"pf-admin-metric-card\"><div className=\"pf-admin-metric-label\">Faturamento hoje</div><div className=\"pf-admin-metric-val\">{money(totals.revenueToday)}</div></div><div className=\"pf-admin-metric-card\"><div className=\"pf-admin-metric-label\">Corridas concluídas</div><div className=\"pf-admin-metric-val\">{totals.completedToday}</div></div></div><p style={{ color: '#8e98a5', lineHeight: 1.6 }}>Os valores acima são os dados operacionais carregados pelo painel. O gateway de pagamento não é alterado nesta etapa para não quebrar o fluxo de corridas.</p></div><div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Status da integração</div><span className=\"pf-admin-status-badge andamento\">Gateway não conectado ao painel</span><p style={{ color: '#8e98a5', lineHeight: 1.6, marginTop: 12 }}>Quando o módulo de pagamentos estiver conectado ao servidor, esta área poderá exibir transações, estornos e conciliação sem usar dados falsos.</p></div></div>;\n    }"
);

source = source.replace(
  "if (activeTab === 'notificacoes') return (\n      <div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Central administrativa</div><div style={{ display: 'grid', gap: 12 }}><div className=\"pf-admin-table-card\"><b>{totals.pendingDrivers}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>motoristas pendentes de aprovação</div></div><div className=\"pf-admin-table-card\"><b>{totals.activeRides}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>corridas ativas agora</div></div><div className=\"pf-admin-table-card\"><b>{totals.onlineDrivers}</b><div style={{ color: '#8e98a5', marginTop: 4 }}>motoristas online</div></div></div></div>\n    );",
  "if (activeTab === 'notificacoes') return (\n      <div className=\"pf-admin-charts-grid\"><div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Central de notificações</div><div style={{ display: 'grid', gap: 10 }}><button type=\"button\" className=\"pf-admin-alert-card\" onClick={() => setActiveTab('motoristas')}><b>{totals.pendingDrivers}</b><span>motoristas aguardando aprovação</span></button><button type=\"button\" className=\"pf-admin-alert-card\" onClick={() => setActiveTab('corridas')}><b>{totals.activeRides}</b><span>corridas ativas agora</span></button><button type=\"button\" className=\"pf-admin-alert-card\" onClick={() => setActiveTab('motoristas')}><b>{totals.onlineDrivers}</b><span>motoristas online</span></button></div></div><div className=\"pf-admin-chart-card\"><div className=\"pf-admin-chart-title\">Ações rápidas</div><div style={{ display: 'grid', gap: 8 }}><ActionButton onClick={() => void loadDashboard()}>↻ Atualizar dados</ActionButton><ActionButton onClick={() => setActiveTab('relatorios')}>📈 Abrir relatórios</ActionButton><ActionButton onClick={() => setActiveTab('configuracoes')}>⚙️ Configurações</ActionButton></div></div></div>\n    );"
);

const oldTop = '<main className="pf-admin-content">{renderPanel()}</main>';
const newTop = '<main className="pf-admin-content"><div data-admin-polish="v2" className="pf-admin-toolbar"><div><strong>{nav.find(([id]) => id === activeTab)?.[2] || \'Painel\'}</strong><span>{loading ? \'Sincronizando…\' : \'Dados atualizados do servidor\'}</span></div><div className="pf-admin-toolbar-actions"><input aria-label="Buscar no painel" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Buscar…" /><button type="button" onClick={() => setAdminSearch(\'\')} disabled={!adminSearch}>Limpar</button><button type="button" onClick={() => void loadDashboard()}>↻ Atualizar</button></div></div>{renderPanel()}</main>';
if (!source.includes(oldTop)) throw new Error('Admin content marker not found');
source = source.replace(oldTop, newTop);

source = source.replace(
  '@media(max-width:900px){.pf-admin-metrics-grid{grid-template-columns:repeat(2,1fr)}.pf-admin-charts-grid{grid-template-columns:1fr}.pf-admin-sidebar{display:none}.pf-admin-content{padding:14px}}',
  '.pf-admin-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;padding:14px 16px;background:#0f1216;border:1px solid #222832;border-radius:16px}.pf-admin-toolbar strong{display:block;font-size:18px}.pf-admin-toolbar span{display:block;color:#7f8a99;font-size:12px;margin-top:3px}.pf-admin-toolbar-actions{display:flex;gap:8px;align-items:center}.pf-admin-toolbar-actions input{width:220px;max-width:42vw;border:1px solid #2a313c;border-radius:10px;background:#090b0e;color:#fff;padding:10px 12px;outline:none}.pf-admin-toolbar-actions button{border:1px solid #2a313c;border-radius:10px;background:#13171d;color:#fff;padding:10px 12px;font-weight:800;cursor:pointer}.pf-admin-toolbar-actions button:disabled{opacity:.45;cursor:not-allowed}.pf-admin-alert-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid #252c36;border-radius:12px;background:#0b0e12;color:#fff;padding:13px;cursor:pointer}.pf-admin-alert-card b{font-size:20px;min-width:34px}.pf-admin-alert-card span{color:#9aa4b2}.pf-admin-mini-grid{grid-template-columns:repeat(2,1fr)!important;margin:0 0 16px}.pf-admin-mini-grid .pf-admin-metric-card{padding:14px}@media(max-width:900px){.pf-admin-metrics-grid{grid-template-columns:repeat(2,1fr)}.pf-admin-charts-grid{grid-template-columns:1fr}.pf-admin-sidebar{display:none}.pf-admin-content{padding:14px}.pf-admin-toolbar{align-items:stretch;flex-direction:column}.pf-admin-toolbar-actions{width:100%}.pf-admin-toolbar-actions input{flex:1;max-width:none}}@media(max-width:520px){.pf-admin-metrics-grid{grid-template-columns:1fr 1fr}.pf-admin-toolbar-actions{flex-wrap:wrap}.pf-admin-toolbar-actions input{width:100%;flex-basis:100%}.pf-admin-toolbar-actions button{flex:1}}'
);

fs.writeFileSync(file, source, 'utf8');
console.log('Admin polish v2 applied');
