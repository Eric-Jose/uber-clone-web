const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
const source = fs.readFileSync(appPath, 'utf8');

const oldHandler = "const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };";
const newHandler = "const handleAdminLogout = () => {\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    window.location.assign('/?loggedOut=1');\n  };";

let updatedSource = source;
if (updatedSource.includes(oldHandler)) updatedSource = updatedSource.replace(oldHandler, newHandler);

// Também cobre a versão já reforçada para garantir que o logout nunca dependa do Firebase.
const reinforcedHandler = /const handleAdminLogout = \(\) => \{[\s\S]*?\n  \};/;
const desiredHandler = "const handleAdminLogout = () => {\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    window.location.assign('/?loggedOut=1');\n  };";
if (updatedSource.includes('const handleAdminLogout = () => {')) {
  updatedSource = updatedSource.replace(reinforcedHandler, desiredHandler);
}

const oldAdminRender = "  if (admin) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
const newAdminRender = "  if (admin && localStorage.getItem('adminToken')) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
if (updatedSource.includes(oldAdminRender)) updatedSource = updatedSource.replace(oldAdminRender, newAdminRender);

if (updatedSource !== source) fs.writeFileSync(appPath, updatedSource, 'utf8');
console.log('[fix-admin-logout] Logout Admin forçado: limpa sessão antes do redirecionamento e exige adminToken.');
