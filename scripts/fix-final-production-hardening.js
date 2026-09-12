const fs = require('fs');
const path = require('path');

const appFile = path.join(process.cwd(), 'src/App.js');
const adminFile = path.join(process.cwd(), 'src/pages/AdminDashboardLive.js');
const cssFile = path.join(process.cwd(), 'src/styles/FinalProductionHardening.css');

if (!fs.existsSync(appFile)) throw new Error('App.js not found');
if (!fs.existsSync(adminFile)) throw new Error('AdminDashboardLive.js not found');

let app = fs.readFileSync(appFile, 'utf8');
let admin = fs.readFileSync(adminFile, 'utf8');

app = app.replace("import AdminPanel from './pages/AdminPanel';\n", '');
app = app.replace("    case 'admin-panel': return <AdminPanel />;\n", '');

if (!admin.includes('data-final-admin-refresh="v1"')) {
  const marker = "  useEffect(() => { void loadDashboard(); }, []);";
  const replacement = `  useEffect(() => { void loadDashboard(); }, []);\n  useEffect(() => {\n    const refresh = () => { if (document.visibilityState === 'visible') void loadDashboard(); };\n    const timer = window.setInterval(refresh, 30000);\n    window.addEventListener('focus', refresh);\n    document.addEventListener('visibilitychange', refresh);\n    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };\n  }, [token]);\n  // data-final-admin-refresh="v1"`;
  if (!admin.includes(marker)) throw new Error('Admin refresh marker not found');
  admin = admin.replace(marker, replacement);
}

const css = `/* Final production hardening: safe touch targets, no horizontal bleed, and mobile map stability. */
html, body, #root { min-height: 100%; }
html, body { background: #050505; }
body { overflow-x: hidden; -webkit-text-size-adjust: 100%; }
button, input, select, textarea { font: inherit; }
button { touch-action: manipulation; }
.leaflet-container { touch-action: pan-x pan-y; }
@media (max-width: 680px) {
  button { min-height: 42px; }
  input, select, textarea { min-height: 44px; }
  .pf-app-layout { width: 100%; max-width: 100%; overflow-x: hidden; }
  .pf-map-screen { min-height: 100dvh; height: 100dvh; }
  .pf-map-topbar { height: calc(56px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); }
  .pf-route-card, .pf-driver-arriving-card { left: 10px; right: 10px; }
  .pf-route-card { top: calc(64px + env(safe-area-inset-top)); border-radius: 18px; }
  .pf-bottom-sheet, .pf-arriving-sheet, .pf-progress-sheet { left: 8px; right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); max-width: none; border-radius: 22px; padding: 14px; }
  .pf-driver-arriving-card { top: calc(64px + env(safe-area-inset-top)); }
  .pf-sheet-car-thumb { width: 84px; }
  .pf-sheet-price-val { font-size: 24px; }
  .pf-route-input-group { min-width: 0; }
  .pf-route-val { font-size: 13px; }
  .pf-chip { min-height: 42px; padding: 9px 12px; }
  .pf-request-btn, .pf-arriving-cancel-btn, .pf-finish-btn { min-height: 50px; padding: 13px 15px; }
  .pf-map-screen * { box-sizing: border-box; }
}
@media (max-width: 380px) {
  .pf-map-topbar { padding-left: 10px; padding-right: 10px; }
  .pf-route-card { left: 6px; right: 6px; padding: 12px; }
  .pf-bottom-sheet, .pf-arriving-sheet, .pf-progress-sheet { left: 6px; right: 6px; padding: 12px; }
  .pf-sheet-car-thumb { width: 72px; }
}
`;
if (!fs.existsSync(cssFile) || fs.readFileSync(cssFile, 'utf8') !== css) fs.writeFileSync(cssFile, css, 'utf8');

const importMarker = "import './styles/FinalProductionHardening.css';";
if (!app.includes(importMarker)) {
  const cssAnchor = "import './styles/PrecoFixo17AccountMenu.css';";
  if (!app.includes(cssAnchor)) throw new Error('App CSS import anchor not found');
  app = app.replace(cssAnchor, `${cssAnchor}\n${importMarker}`);
}

fs.writeFileSync(appFile, app, 'utf8');
fs.writeFileSync(adminFile, admin, 'utf8');
console.log('Final production hardening applied');
