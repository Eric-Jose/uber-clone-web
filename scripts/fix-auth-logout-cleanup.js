const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'src', 'App.js');
if (!fs.existsSync(appPath)) throw new Error('src/App.js not found');

let source = fs.readFileSync(appPath, 'utf8');
const oldBlock = "  const handleLogout = async () => { await logoutFirebase(); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };";
const newBlock = "  const handleLogout = async () => {\n    try { await logoutFirebase(); } catch (_) { /* local session cleanup must continue even if Firebase sign-out fails */ }\n    try {\n      localStorage.removeItem('token');\n      localStorage.removeItem('user');\n      localStorage.removeItem('adminToken');\n      localStorage.removeItem('admin');\n      sessionStorage.removeItem('token');\n      sessionStorage.removeItem('user');\n    } catch (_) {}\n    setUser(null);\n    setAdmin(null);\n    setCurrentPage('home');\n  };";

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(appPath, source, 'utf8');
  console.log('auth logout cleanup: updated');
} else if (source.includes('local session cleanup must continue even if Firebase sign-out fails')) {
  console.log('auth logout cleanup: already applied');
} else {
  throw new Error('Expected handleLogout block not found; refusing unsafe patch');
}
