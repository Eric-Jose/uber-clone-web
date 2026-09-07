import React, { useState } from 'react';
import '../styles/PrecoFixo17Reference.css';

const DEFAULT_ADMIN_STATS = {
  users: '1.250',
  usersTrend: '+12%',
  drivers: '320',
  driversTrend: '+8%',
  ridesToday: '580',
  ridesTrend: '+15%',
  revenue: 'R$ 9.860,00',
  revenueTrend: '+18%'
};

const DEFAULT_RECENT_RIDES = [
  { id: '#1250', user: 'Ana Paula', driver: 'Carlos Ferreira', origin: 'Av. das Palmeiras, 123', destination: 'Rua dos Ipês, 456', amount: 'R$ 17,00', status: 'Concluída', time: '14:32' },
  { id: '#1249', user: 'Roberto Silva', driver: 'Marcos Souza', origin: 'Rua Minas Gerais, 78', destination: 'Shopping Central', amount: 'R$ 17,00', status: 'Em andamento', time: '14:28' },
  { id: '#1248', user: 'Juliana Costa', driver: 'Carlos Ferreira', origin: 'Av. Brasil, 500', destination: 'Terminal Central', amount: 'R$ 17,00', status: 'Concluída', time: '14:15' },
  { id: '#1247', user: 'Fernando Lima', driver: '—', origin: 'Rua 7 de Setembro, 32', destination: 'Hospital Central', amount: 'R$ 17,00', status: 'Cancelada', time: '14:02' }
];

export default function AdminDashboardLive({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('painel');
  const [rides] = useState(DEFAULT_RECENT_RIDES);

  return (
    <div className="pf-admin-screen">
      <style>{`
        .pf-admin-screen {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .pf-admin-topbar {
          height: 60px;
          background: #0d0f13;
          border-bottom: 1px solid #1c2128;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .pf-admin-brand {
          font-size: 18px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.02em;
        }
        .pf-admin-brand span { color: #ffffff; }
        .pf-admin-brand b { color: #ff5a00; }
        .pf-admin-brand small {
          color: #8e98a5;
          font-size: 11px;
          font-style: normal;
          margin-left: 8px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .pf-admin-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pf-admin-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ff5a00;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #ffffff;
        }
        .pf-admin-name {
          font-size: 14px;
          font-weight: 700;
        }
        .pf-admin-layout {
          display: flex;
          flex: 1;
        }
        .pf-admin-sidebar {
          width: 230px;
          background: #090b0e;
          border-right: 1px solid #1c2128;
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pf-admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          border-radius: 12px;
          color: #a4b0bf;
          font-size: 14px;
          font-weight: 600;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .pf-admin-nav-item:hover {
          background: #13171d;
          color: #ffffff;
        }
        .pf-admin-nav-item.active {
          background: #ff5a00;
          color: #ffffff;
          font-weight: 800;
        }
        .pf-admin-nav-item.logout {
          margin-top: auto;
          color: #ef4444;
        }
        .pf-admin-nav-item.logout:hover {
          background: rgba(239, 68, 68, 0.12);
        }
        .pf-admin-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          max-width: 1200px;
        }
        .pf-admin-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .pf-admin-metric-card {
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 18px;
          padding: 18px;
        }
        .pf-admin-metric-label {
          color: #8e98a5;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .pf-admin-metric-val {
          font-size: 26px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.1;
          margin-bottom: 8px;
        }
        .pf-admin-metric-trend {
          font-size: 12px;
          font-weight: 700;
          color: #22c55e;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pf-admin-charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        .pf-admin-chart-card {
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 18px;
          padding: 20px;
        }
        .pf-admin-chart-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 16px;
        }
        .pf-admin-table-card {
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 18px;
          padding: 20px;
        }
        .pf-admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .pf-admin-table th {
          text-align: left;
          color: #7b8696;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 10px 12px;
          border-bottom: 1px solid #222832;
        }
        .pf-admin-table td {
          padding: 14px 12px;
          border-bottom: 1px solid #181d24;
          color: #e2e8f0;
        }
        .pf-admin-status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }
        .pf-admin-status-badge.concluida {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
        }
        .pf-admin-status-badge.andamento {
          background: rgba(255, 90, 0, 0.12);
          color: #ff5a00;
        }
        .pf-admin-status-badge.cancelada {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }
        @media (max-width: 900px) {
          .pf-admin-metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .pf-admin-charts-grid { grid-template-columns: 1fr; }
          .pf-admin-sidebar { display: none; }
        }
      `}</style>

      {/* Topbar */}
      <header className="pf-admin-topbar">
        <div className="pf-admin-brand">
          <span>PREÇO </span>
          <b>FIXO 17</b>
          <small>PAINEL ADMIN</small>
        </div>
        <div className="pf-admin-user">
          <span className="pf-admin-name">{admin?.name || 'Administrador'}</span>
          <div className="pf-admin-avatar">AD</div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="pf-admin-layout">
        {/* Sidebar */}
        <aside className="pf-admin-sidebar">
          {[
            { id: 'painel', label: 'Painel', icon: '📊' },
            { id: 'usuarios', label: 'Usuários', icon: '👥' },
            { id: 'motoristas', label: 'Motoristas', icon: '🚗' },
            { id: 'corridas', label: 'Corridas', icon: '🗺️' },
            { id: 'pagamentos', label: 'Pagamentos', icon: '💳' },
            { id: 'promocoes', label: 'Promoções', icon: '🎁' },
            { id: 'avaliacoes', label: 'Avaliações', icon: '⭐' },
            { id: 'notificacoes', label: 'Notificações', icon: '🔔' },
            { id: 'relatorios', label: 'Relatórios', icon: '📈' },
            { id: 'configuracoes', label: 'Configurações', icon: '⚙️' }
          ].map((nav) => (
            <button
              key={nav.id}
              type="button"
              className={`pf-admin-nav-item ${activeTab === nav.id ? 'active' : ''}`}
              onClick={() => setActiveTab(nav.id)}
            >
              <span>{nav.icon}</span>
              <span>{nav.label}</span>
            </button>
          ))}

          <button
            type="button"
            className="pf-admin-nav-item logout"
            onClick={onLogout}
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </aside>

        {/* Content */}
        <main className="pf-admin-content">
          {/* 4 Metric cards */}
          <div className="pf-admin-metrics-grid">
            <div className="pf-admin-metric-card">
              <div className="pf-admin-metric-label">Usuários</div>
              <div className="pf-admin-metric-val">{DEFAULT_ADMIN_STATS.users}</div>
              <div className="pf-admin-metric-trend">{DEFAULT_ADMIN_STATS.usersTrend} este mês</div>
            </div>

            <div className="pf-admin-metric-card">
              <div className="pf-admin-metric-label">Motoristas</div>
              <div className="pf-admin-metric-val">{DEFAULT_ADMIN_STATS.drivers}</div>
              <div className="pf-admin-metric-trend">{DEFAULT_ADMIN_STATS.driversTrend} este mês</div>
            </div>

            <div className="pf-admin-metric-card">
              <div className="pf-admin-metric-label">Corridas hoje</div>
              <div className="pf-admin-metric-val">{DEFAULT_ADMIN_STATS.ridesToday}</div>
              <div className="pf-admin-metric-trend">{DEFAULT_ADMIN_STATS.ridesTrend} hoje</div>
            </div>

            <div className="pf-admin-metric-card">
              <div className="pf-admin-metric-label">Faturamento</div>
              <div className="pf-admin-metric-val">{DEFAULT_ADMIN_STATS.revenue}</div>
              <div className="pf-admin-metric-trend">{DEFAULT_ADMIN_STATS.revenueTrend} este mês</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="pf-admin-charts-grid">
            {/* SVG Line Chart */}
            <div className="pf-admin-chart-card">
              <div className="pf-admin-chart-title">Corridas nos últimos 7 dias</div>
              <div style={{ height: 180, width: '100%' }}>
                <svg viewBox="0 0 500 160" width="100%" height="100%">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff5a00" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#ff5a00" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="40" y1="30" x2="480" y2="30" stroke="#1f2632" strokeDasharray="3" />
                  <line x1="40" y1="70" x2="480" y2="70" stroke="#1f2632" strokeDasharray="3" />
                  <line x1="40" y1="110" x2="480" y2="110" stroke="#1f2632" strokeDasharray="3" />
                  {/* Area fill */}
                  <polygon
                    points="40,110 95,95 160,115 230,70 300,85 370,45 440,35 440,140 40,140"
                    fill="url(#lineGrad)"
                  />
                  {/* Line */}
                  <polyline
                    points="40,110 95,95 160,115 230,70 300,85 370,45 440,35"
                    fill="none"
                    stroke="#ff5a00"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Points */}
                  {[[40,110],[95,95],[160,115],[230,70],[300,85],[370,45],[440,35]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="4" fill="#ffffff" stroke="#ff5a00" strokeWidth="2.5" />
                  ))}
                  {/* Labels */}
                  <text x="40" y="155" fill="#728096" fontSize="11" textAnchor="middle">Seg</text>
                  <text x="95" y="155" fill="#728096" fontSize="11" textAnchor="middle">Ter</text>
                  <text x="160" y="155" fill="#728096" fontSize="11" textAnchor="middle">Qua</text>
                  <text x="230" y="155" fill="#728096" fontSize="11" textAnchor="middle">Qui</text>
                  <text x="300" y="155" fill="#728096" fontSize="11" textAnchor="middle">Sex</text>
                  <text x="370" y="155" fill="#728096" fontSize="11" textAnchor="middle">Sáb</text>
                  <text x="440" y="155" fill="#728096" fontSize="11" textAnchor="middle">Dom</text>
                </svg>
              </div>
            </div>

            {/* SVG Donut Chart */}
            <div className="pf-admin-chart-card">
              <div className="pf-admin-chart-title">Corridas por status</div>
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg viewBox="0 0 100 100" width="130" height="130">
                  {/* Concluídas (70%) */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#22c55e" strokeWidth="12" strokeDasharray="167 238" strokeDashoffset="0" />
                  {/* Canceladas (20%) */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#ef4444" strokeWidth="12" strokeDasharray="47 238" strokeDashoffset="-167" />
                  {/* Em andamento (10%) */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#ff5a00" strokeWidth="12" strokeDasharray="24 238" strokeDashoffset="-214" />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <span style={{ fontSize: 20, fontWeight: 900 }}>580</span>
                  <div style={{ fontSize: 10, color: '#8e98a5' }}>Hoje</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11, color: '#a0aec0', marginTop: 8 }}>
                <span>🟢 70% Concluídas</span>
                <span>🔴 20% Canceladas</span>
                <span>🟠 10% Andamento</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="pf-admin-table-card">
            <div className="pf-admin-chart-title">Últimas corridas</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pf-admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuário</th>
                    <th>Motorista</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {rides.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.id}</td>
                      <td>{r.user}</td>
                      <td>{r.driver}</td>
                      <td>{r.origin}</td>
                      <td>{r.destination}</td>
                      <td style={{ fontWeight: 700 }}>{r.amount}</td>
                      <td>
                        <span
                          className={`pf-admin-status-badge ${
                            r.status === 'Concluída'
                              ? 'concluida'
                              : r.status === 'Em andamento'
                              ? 'andamento'
                              : 'cancelada'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ color: '#8e98a5' }}>{r.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
