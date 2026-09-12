const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'src', 'pages', 'DriverDashboardMapPro.js');
let source = fs.readFileSync(target, 'utf8');

const originalSignature = 'export default function DriverDashboardMapPro() {';
const patchedSignature = 'export default function DriverDashboardMapPro({ onOpenMenu, onNavigate, onLogout }) {';
if (source.includes(originalSignature)) source = source.replace(originalSignature, patchedSignature);

const marker = '<div className="driver-box"><div className="driver-row"><div><h1 style={{ margin: 0 }}>Painel do motorista</h1>';
const replacement = '<div className="driver-box"><div className="driver-row"><div><h1 style={{ margin: 0 }}>Painel do motorista</h1>';

if (!source.includes('driver-nav-actions')) {
  const nav = '<div className="driver-nav-actions" style={{ display: \'flex\', gap: 8, flexWrap: \'wrap\', marginBottom: 12 }}><button type="button" className="driver-btn" style={{ background: \'#111827\', color: \'#fff\' }} onClick={function () { if (onOpenMenu) onOpenMenu(); }}>☰ Menu</button><button type="button" className="driver-btn" style={{ background: \'#e5e7eb\', color: \'#111827\' }} onClick={function () { if (onNavigate) onNavigate(\'profile\'); }}>← Voltar</button><button type="button" className="driver-btn driver-danger" onClick={function () { if (onLogout) onLogout(); }}>↪ Sair</button></div>';
  if (source.includes(marker)) source = source.replace(marker, nav + replacement);
}

fs.writeFileSync(target, source, 'utf8');
console.log('Driver dashboard navigation: Menu, Voltar e Sair ensured.');
