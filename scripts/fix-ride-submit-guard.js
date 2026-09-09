const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('const rideSubmitRef = useRef(false);')) {
  const marker = '  const elapsedTimer = useRef(null);';
  if (!source.includes(marker)) throw new Error('MapRidePro refs marker not found');
  source = source.replace(marker, marker + '\n  const rideSubmitRef = useRef(false);');
}

if (!source.includes("from '../services/rideDispatch'")) {
  source = source.replace("import WebSocketService from '../services/WebSocketService';", "import WebSocketService from '../services/WebSocketService';\nimport { dispatchRideSearch } from '../services/rideDispatch';");
}

const start = source.indexOf('  const handleRequestRide = async () => {');
const end = source.indexOf('\n\n  const handleCancelRide', start);
if (start < 0 || end < 0) throw new Error('MapRidePro ride request handler not found');

let block = source.slice(start, end);
if (!block.includes('rideSubmitRef.current')) {
  block = block
    .replace("  const handleRequestRide = async () => {\n    if (!token)", "  const handleRequestRide = async () => {\n    if (rideSubmitRef.current || busy) return;\n    if (!token)")
    .replace("    setBusy(true); setError('');", "    rideSubmitRef.current = true;\n    setBusy(true); setError('');")
    .replace("    } finally {\n      setBusy(false);\n    }", "    } finally {\n      rideSubmitRef.current = false;\n      setBusy(false);\n    }");
}

if (!block.includes('dispatchRideSearch(createdRide.id, token)')) {
  block = block.replace(
    "      try { WebSocketService.joinRideRoom(createdRide.id); } catch (_) {}",
    "      try { WebSocketService.joinRideRoom(createdRide.id); } catch (_) {}\n      // Keep automatic dispatch alive if the first driver wave does not find an online driver.\n      void dispatchRideSearch(createdRide.id, token);"
  );
}

source = source.slice(0, start) + block + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-ride-submit-guard] Duplicate submission guard and automatic driver redispatch applied.');
