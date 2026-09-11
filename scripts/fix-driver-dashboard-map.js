const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'src', 'pages', 'DriverDashboardMapPro.js');
if (!fs.existsSync(target)) process.exit(0);

let source = fs.readFileSync(target, 'utf8');

// Restore the driver map before a ride is accepted.
const mapMarker = '// DRIVER_DASHBOARD_MAP_PATCH_APPLIED';
if (!source.includes(mapMarker)) {
  const needle = "    {!ride && !completed && requests.length > 0 && <div className=\"driver-box\"><h2 style={{ marginTop: 0 }}>🚕 Corridas disponíveis</h2>";
  const replacement = "    {!ride && !completed && <div className=\"driver-box\"><div className=\"driver-row\"><h2 style={{ marginTop: 0 }}>🗺️ Mapa do motorista</h2><span className=\"driver-muted\">{online ? 'Sua posição em tempo real' : 'Ative o GPS para ficar online'}</span></div><DriverRideMap driverLocation={driverLocation} passengerLocation={null} destinationLocation={null} status=\"SEARCHING\" /></div>}\n\n    " + needle;
  if (source.includes(needle)) {
    source = source.replace(needle, replacement);
    source = source.replace("  </div>;\n}", "  </div>;\n}\n" + mapMarker);
  }
}

// Reconcile the local request list with the authoritative /pending response.
// Without this, an old WebSocket/polling item could remain visible with an
// Accept button even after another driver had already accepted the ride.
const pendingMarker = '// DRIVER_PENDING_RECONCILIATION_PATCH_APPLIED';
if (!source.includes(pendingMarker)) {
  const old = "        setRequests(function (current) {\n          var map = {};\n          current.concat(pending).forEach(function (item) { if (item && item.id) map[String(item.id)] = item; });\n          return Object.keys(map).map(function (key) { return map[key]; }).slice(0, 20);\n        });";
  const replacement = "        setRequests(pending.filter(function (item) { return item && item.id; }).slice(0, 20));";
  if (source.includes(old)) {
    source = source.replace(old, replacement);
    source += "\n" + pendingMarker + "\n";
  }
}

fs.writeFileSync(target, source);
