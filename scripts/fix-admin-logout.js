const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
const source = fs.readFileSync(appPath, 'utf8');

const oldHandler = "const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };";
const newHandler = "const handleAdminLogout = () => {\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    window.location.assign('/?loggedOut=1');\n  };";

let updatedSource = source;
if (updatedSource.includes(oldHandler)) updatedSource = updatedSource.replace(oldHandler, newHandler);

const reinforcedHandler = /const handleAdminLogout = \(\) => \{[\s\S]*?\n  \};/;
const desiredHandler = "const handleAdminLogout = () => {\n    try {\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      sessionStorage.clear();\n    } catch (_) {}\n    setAdmin(null);\n    setUser(null);\n    setCurrentPage('home');\n    window.location.assign('/?loggedOut=1');\n  };";
if (updatedSource.includes('const handleAdminLogout = () => {')) updatedSource = updatedSource.replace(reinforcedHandler, desiredHandler);

const oldAdminRender = "  if (admin) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
const newAdminRender = "  if (admin && localStorage.getItem('adminToken')) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;";
if (updatedSource.includes(oldAdminRender)) updatedSource = updatedSource.replace(oldAdminRender, newAdminRender);

const oldChildrenRender = "{React.cloneElement(children, {\n          onOpenMenu: () => setMenuOpen(true),\n          onOpenNotifications: () => onNavigate('notifications'),\n          onNavigate: onNavigate\n        })}";
const newChildrenRender = "{React.Children.map(children, (child) => (\n          React.isValidElement(child)\n            ? React.cloneElement(child, {\n                onOpenMenu: () => setMenuOpen(true),\n                onOpenNotifications: () => onNavigate('notifications'),\n                onNavigate: onNavigate\n              })\n            : child\n        ))}";
if (updatedSource.includes(oldChildrenRender)) updatedSource = updatedSource.replace(oldChildrenRender, newChildrenRender);

if (updatedSource !== source) fs.writeFileSync(appPath, updatedSource, 'utf8');

// O serviço compartilhado não pode mais expor operações de corrida como no-op.
// As telas novas já usam HTTP, mas este fallback mantém qualquer chamada legada funcional.
const socketPath = path.join(__dirname, '..', 'src', 'services', 'WebSocketService.js');
if (fs.existsSync(socketPath)) {
  let socketSource = fs.readFileSync(socketPath, 'utf8');
  const replacements = [
    ["  requestRide(rideData) { return Boolean(rideData?.rideId); }", "  async requestRide(rideData) {\n    const token = localStorage.getItem('token');\n    if (!token || !rideData?.origin || !rideData?.destination) return null;\n    const response = await fetch(`${BACKEND_URL}/api/rides/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ origin: rideData.origin, destination: rideData.destination }), cache: 'no-store' });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data?.error || 'Não foi possível solicitar a corrida.');\n    return data?.ride || data;\n  }"],
    ["  acceptRide(rideId, driverId) { return Boolean(rideId && driverId); }", "  async acceptRide(rideId) {\n    const token = localStorage.getItem('token');\n    if (!token || !rideId) return null;\n    const response = await fetch(`${BACKEND_URL}/api/rides/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ rideId }), cache: 'no-store' });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data?.error || 'Não foi possível aceitar a corrida.');\n    return data?.ride || data;\n  }"],
    ["  startRide(rideId, driverId) { return Boolean(rideId && driverId); }", "  async startRide(rideId) {\n    const token = localStorage.getItem('token');\n    if (!token || !rideId) return null;\n    const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'IN_PROGRESS' }), cache: 'no-store' });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data?.error || 'Não foi possível iniciar a corrida.');\n    return data?.ride || data;\n  }"],
    ["  endRide(rideId, driverId) { return Boolean(rideId && driverId); }", "  async endRide(rideId) {\n    const token = localStorage.getItem('token');\n    if (!token || !rideId) return null;\n    const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'COMPLETED' }), cache: 'no-store' });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data?.error || 'Não foi possível finalizar a corrida.');\n    return data?.ride || data;\n  }"],
    ["  cancelRide(rideId) { return Boolean(rideId); }", "  async cancelRide(rideId, reason = 'Cancelada pelo usuário') {\n    const token = localStorage.getItem('token');\n    if (!token || !rideId) return null;\n    const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason }), cache: 'no-store' });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data?.error || 'Não foi possível cancelar a corrida.');\n    return data?.ride || data;\n  }"]
  ];
  for (const [before, after] of replacements) {
    if (socketSource.includes(before)) socketSource = socketSource.replace(before, after);
  }
  fs.writeFileSync(socketPath, socketSource, 'utf8');
}

console.log('[fix-admin-logout] Sessão Admin protegida, AccountPanel multi-filhos corrigido e ações legadas de corrida conectadas ao backend.');
