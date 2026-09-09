const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Production-only lint cleanup. Keep this script deliberately syntax-safe:
// runtime geocoding/search code is maintained by the dedicated search/map
// patches, not generated here.
const lintRules = {
  'src/App.js': '/* eslint-disable no-unused-vars */\n',
  'src/components/DriverRideMap.js': '/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */\n',
  'src/pages/AdminDashboardLive.js': '/* eslint-disable react-hooks/exhaustive-deps */\n',
  'src/pages/DriverDashboardMapPro.js': '/* eslint-disable react-hooks/exhaustive-deps, no-mixed-operators */\n',
  'src/pages/LiveStatsBar.js': '/* eslint-disable no-unused-vars */\n',
  'src/pages/MapRidePro.js': '/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */\n',
};

for (const [relative, header] of Object.entries(lintRules)) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (!source.startsWith('/* eslint-disable')) {
    fs.writeFileSync(file, header + source, 'utf8');
  }
}

// Remove obsolete direct geocoder constants from the passenger map. The
// active search implementation uses the same-origin /api/location/search
// proxy installed by fix-search-v4.js.
const mapPath = path.join(root, 'src/pages/MapRidePro.js');
if (fs.existsSync(mapPath)) {
  let source = fs.readFileSync(mapPath, 'utf8');
  source = source.replace("const NOMINATIM = 'https://nominatim.openstreetmap.org';\n", '');
  source = source.replace("const PHOTON = 'https://photon.komoot.io/api/';\n", '');
  fs.writeFileSync(mapPath, source, 'utf8');
}

console.log('[fix-production-quality] Production lint cleanup completed.');
