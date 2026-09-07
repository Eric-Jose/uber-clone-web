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

// Corrige o crash de renderização quando AccountPanel recebe múltiplos filhos.
const oldChildrenRender = "{React.cloneElement(children, {\n          onOpenMenu: () => setMenuOpen(true),\n          onOpenNotifications: () => onNavigate('notifications'),\n          onNavigate: onNavigate\n        })}";
const newChildrenRender = "{React.Children.map(children, (child) => (\n          React.isValidElement(child)\n            ? React.cloneElement(child, {\n                onOpenMenu: () => setMenuOpen(true),\n                onOpenNotifications: () => onNavigate('notifications'),\n                onNavigate: onNavigate\n              })\n            : child\n        ))}";
if (updatedSource.includes(oldChildrenRender)) updatedSource = updatedSource.replace(oldChildrenRender, newChildrenRender);

if (updatedSource !== source) fs.writeFileSync(appPath, updatedSource, 'utf8');
console.log('[fix-admin-logout] Sessão Admin protegida e AccountPanel multi-filhos corrigido.');
