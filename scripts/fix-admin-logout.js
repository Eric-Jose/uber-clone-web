const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
const source = fs.readFileSync(appPath, 'utf8');

const oldHandler = "const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };";
const newHandler = "const handleAdminLogout = async () => {\n    try { await logoutFirebase(); } catch (_) {}\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    window.location.replace('/');\n  };";

if (!source.includes(oldHandler)) {
  console.log('[fix-admin-logout] Nenhuma alteração necessária.');
  process.exit(0);
}

fs.writeFileSync(appPath, source.replace(oldHandler, newHandler), 'utf8');
console.log('[fix-admin-logout] Logout administrativo reforçado com limpeza de sessão e redirecionamento.');
