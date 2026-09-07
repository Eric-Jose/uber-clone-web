const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
const source = fs.readFileSync(appPath, 'utf8');

const oldHandler = "const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };";
const newHandler = "const handleAdminLogout = () => {\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    try { void logoutFirebase(); } catch (_) {}\n    window.location.replace('/');\n  };";

let updatedSource = source;
if (updatedSource.includes(oldHandler)) {
  updatedSource = updatedSource.replace(oldHandler, newHandler);
  console.log('[fix-admin-logout] Logout administrativo imediato e sem bloqueio por Firebase.');
}

const oldAdminRender = "  if (admin) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
const newAdminRender = "  if (admin && localStorage.getItem('adminToken')) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
if (updatedSource.includes(oldAdminRender)) {
  updatedSource = updatedSource.replace(oldAdminRender, newAdminRender);
  console.log('[fix-admin-logout] Painel Admin exige adminToken válido para permanecer aberto.');
}

if (updatedSource !== source) fs.writeFileSync(appPath, updatedSource, 'utf8');
