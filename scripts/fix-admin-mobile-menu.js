const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/AdminDashboardLive.js');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("const [adminMenuOpen, setAdminMenuOpen] = useState(false);")) {
  source = source.replace(
    "const [activeTab, setActiveTab] = useState('painel');",
    "const [activeTab, setActiveTab] = useState('painel');\n  const [adminMenuOpen, setAdminMenuOpen] = useState(false);"
  );
}

source = source.replace(
  ".pf-admin-brand{font-size:18px;font-weight:900;font-style:italic}",
  ".pf-admin-menu-toggle{display:none;border:1px solid #2a313c;background:#15191f;color:#fff;width:40px;height:40px;border-radius:11px;font-size:20px;cursor:pointer;align-items:center;justify-content:center}.pf-admin-brand{font-size:18px;font-weight:900;font-style:italic}"
);

source = source.replace(
  ".pf-admin-user{display:flex;align-items:center;gap:12px}",
  ".pf-admin-user{display:flex;align-items:center;gap:12px}.pf-admin-mobile-menu{display:none}"
);

source = source.replace(
  "@media(max-width:900px){.pf-admin-metrics-grid{grid-template-columns:repeat(2,1fr)}.pf-admin-charts-grid{grid-template-columns:1fr}.pf-admin-sidebar{display:none}.pf-admin-content{padding:14px}}",
  "@media(max-width:900px){.pf-admin-menu-toggle{display:flex}.pf-admin-topbar{height:64px;padding:0 12px}.pf-admin-brand small{display:none}.pf-admin-user{gap:8px}.pf-admin-name{display:none}.pf-admin-metrics-grid{grid-template-columns:repeat(2,1fr)}.pf-admin-charts-grid{grid-template-columns:1fr}.pf-admin-sidebar{display:none}.pf-admin-content{padding:14px}.pf-admin-mobile-menu{position:fixed;display:flex;flex-direction:column;gap:5px;top:64px;left:10px;right:10px;max-height:calc(100vh - 78px);overflow:auto;background:#0b0e12;border:1px solid #2a313c;border-radius:16px;padding:10px;z-index:250;box-shadow:0 18px 50px rgba(0,0,0,.55)}.pf-admin-mobile-menu .pf-admin-nav-item{width:100%;padding:13px 14px}.pf-admin-mobile-menu-backdrop{position:fixed;inset:64px 0 0;background:rgba(0,0,0,.48);z-index:240}}"
);

source = source.replace(
  '<header className="pf-admin-topbar"><div className="pf-admin-brand">',
  '<header className="pf-admin-topbar"><button type="button" className="pf-admin-menu-toggle" aria-label="Abrir menu administrativo" onClick={() => setAdminMenuOpen((value) => !value)}>{adminMenuOpen ? "×" : "☰"}</button><div className="pf-admin-brand">'
);

const oldLayout = '<div className="pf-admin-layout"><aside className="pf-admin-sidebar">{nav.map(([id, icon, label]) => <button key={id} type="button" className={`pf-admin-nav-item ${activeTab === id ? \'active\' : \'\'}`} onClick={() => setActiveTab(id)}><span>{icon}</span><span>{label}</span></button>)}<button type="button" className="pf-admin-nav-item logout" onClick={safeLogout}><span>🚪</span><span>Sair</span></button></aside><main className="pf-admin-content">{renderPanel()}</main></div>';
const newLayout = '<div className="pf-admin-layout"><aside className="pf-admin-sidebar">{nav.map(([id, icon, label]) => <button key={id} type="button" className={`pf-admin-nav-item ${activeTab === id ? \'active\' : \'\'}`} onClick={() => setActiveTab(id)}><span>{icon}</span><span>{label}</span></button>)}<button type="button" className="pf-admin-nav-item logout" onClick={safeLogout}><span>🚪</span><span>Sair</span></button></aside><main className="pf-admin-content">{renderPanel()}</main></div>{adminMenuOpen && <><div className="pf-admin-mobile-menu-backdrop" onClick={() => setAdminMenuOpen(false)} /><nav className="pf-admin-mobile-menu" aria-label="Menu administrativo mobile">{nav.map(([id, icon, label]) => <button key={id} type="button" className={`pf-admin-nav-item ${activeTab === id ? \'active\' : \'\'}`} onClick={() => { setActiveTab(id); setAdminMenuOpen(false); }}><span>{icon}</span><span>{label}</span></button>)}<button type="button" className="pf-admin-nav-item logout" onClick={safeLogout}><span>🚪</span><span>Sair</span></button></nav></>}';

if (!source.includes('pf-admin-mobile-menu" aria-label="Menu administrativo mobile')) {
  if (!source.includes(oldLayout)) {
    throw new Error('Admin layout marker not found; refusing unsafe patch.');
  }
  source = source.replace(oldLayout, newLayout);
}

fs.writeFileSync(file, source);
console.log('[admin-mobile-menu] Responsive admin menu restored.');
