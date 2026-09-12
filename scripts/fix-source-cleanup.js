const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'src', 'App.js');
if (!fs.existsSync(appPath)) throw new Error('src/App.js not found');

let source = fs.readFileSync(appPath, 'utf8');
let changed = false;

const legacyImport = "import AdminPanel from './pages/AdminPanel';\n";
if (source.includes(legacyImport)) {
  source = source.replace(legacyImport, '');
  changed = true;
}

const legacyCase = "    case 'admin-panel': return <AdminPanel />;\n";
if (source.includes(legacyCase)) {
  source = source.replace(legacyCase, '');
  changed = true;
}

const oldClone = "React.cloneElement(child, { onOpenMenu: () => setMenuOpen(true), onOpenNotifications: () => onNavigate('notifications'), onNavigate })";
const newClone = "React.cloneElement(child, { onOpenMenu: () => setMenuOpen(true), onOpenNotifications: () => onNavigate('notifications'), onNavigate, onLogout })";
if (source.includes(oldClone)) {
  source = source.replace(oldClone, newClone);
  changed = true;
}

if (changed) fs.writeFileSync(appPath, source, 'utf8');
console.log(`source cleanup: ${changed ? 'updated' : 'already clean'}`);
