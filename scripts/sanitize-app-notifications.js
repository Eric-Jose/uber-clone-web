const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'App.js');
if (!fs.existsSync(file)) process.exit(0);

let source = fs.readFileSync(file, 'utf8');

// Build-time guard: older patch passes could inject the notification state
// more than once. Keep exactly one import/state/effect block so CRA/Babel
// never receives duplicate declarations.
const importLine = "import { getUnreadNotificationCount } from './services/notificationService';\n";
const importCount = source.split(importLine).length - 1;
if (importCount > 1) {
  let seen = 0;
  source = source.replaceAll(importLine, () => (++seen === 1 ? importLine : ''));
}

const stateBlock = /  const \[unreadNotifications, setUnreadNotifications\] = useState\(\(\) => getUnreadNotificationCount\(\)\);\n  const isDriver = account\?\.userType === 'driver' && account\?\.driverApprovalStatus === 'approved';\n  useEffect\(\(\) => \{\n    const refresh = \(\) => setUnreadNotifications\(getUnreadNotificationCount\(\)\);\n    refresh\(\);\n    window\.addEventListener\('storage', refresh\);\n    window\.addEventListener\('pf17-notifications-updated', refresh\);\n    return \(\) => \{ window\.removeEventListener\('storage', refresh\); window\.removeEventListener\('pf17-notifications-updated', refresh\); \};\n  \}, \[account\?\.uid, account\?\.id, account\?\.email\]\);/g;
const blocks = source.match(stateBlock) || [];
if (blocks.length > 1) {
  let seen = 0;
  source = source.replace(stateBlock, (match) => (++seen === 1 ? match : "  const isDriver = account?.userType === 'driver' && account?.driverApprovalStatus === 'approved';"));
}

fs.writeFileSync(file, source, 'utf8');
console.log(`[sanitize-app-notifications] imports=${importCount}, blocks=${blocks.length}; duplicate guard applied.`);
