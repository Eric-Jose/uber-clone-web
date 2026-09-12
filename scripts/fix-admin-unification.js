const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'src', 'App.js');
if (!fs.existsSync(appPath)) process.exit(0);

let source = fs.readFileSync(appPath, 'utf8');
const before = source;

source = source.replace(/import AdminPanel from ['"]\.\/pages\/AdminPanel['"];\n?/, '');
source = source.replace(/\n\s*case ['"]admin-panel['"]:\s*return <AdminPanel \/>;?/, '');

if (source !== before) {
  fs.writeFileSync(appPath, source, 'utf8');
  console.log('[admin-unification] Removed legacy AdminPanel route/import; AdminDashboardLive is authoritative.');
} else {
  console.log('[admin-unification] Already unified; no App.js changes needed.');
}
