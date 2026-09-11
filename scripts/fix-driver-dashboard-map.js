const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'src', 'pages', 'DriverDashboardMapPro.js');
if (!fs.existsSync(target)) process.exit(0);

let source = fs.readFileSync(target, 'utf8');
const marker = '// DRIVER_DASHBOARD_MAP_PATCH_APPLIED';
if (source.includes(marker)) process.exit(0);

const needle = "    {!ride && !completed && requests.length > 0 && <div className=\"driver-box\"><h2 style={{ marginTop: 0 }}>🚕 Corridas disponíveis</h2>";
const replacement = "    {!ride && !completed && <div className=\"driver-box\"><div className=\"driver-row\"><h2 style={{ marginTop: 0 }}>🗺️ Mapa do motorista</h2><span className=\"driver-muted\">{online ? 'Sua posição em tempo real' : 'Ative o GPS para ficar online'}</span></div><DriverRideMap driverLocation={driverLocation} passengerLocation={null} destinationLocation={null} status=\"SEARCHING\" /></div>}\n\n    " + needle;
if (!source.includes(needle)) process.exit(0);
source = source.replace(needle, replacement);
source = source.replace("  </div>;\n}", "  </div>;\n}\n" + marker);
fs.writeFileSync(target, source);
