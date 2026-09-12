const fs = require('fs');
const path = require('path');

const appFile = path.join(process.cwd(), 'src/App.js');
const adminFile = path.join(process.cwd(), 'src/pages/AdminDashboardLive.js');
const cssFile = path.join(process.cwd(), 'src/styles/FinalProductionHardening.css');

if (!fs.existsSync(appFile)) throw new Error('App.js not found');
if (!fs.existsSync(adminFile)) throw new Error('AdminDashboardLive.js not found');

let app = fs.readFileSync(appFile, 'utf8');
let admin = fs.readFileSync(adminFile, 'utf8');

// Remove the obsolete legacy admin entry from source as well as from the build-time unifier.
app = app.replace("import AdminPanel from './pages/AdminPanel';\n", '');
app = app.replace("    case 'admin-panel': return <AdminPanel />;\n", '');

// Keep the live admin dashboard fresh without disturbing any ride lifecycle code.
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
