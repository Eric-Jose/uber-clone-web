const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('const rideSubmitRef = useRef(false);')) {
  const marker = '  const elapsedTimer = useRef(null);';
  if (!source.includes(marker)) throw new Error('MapRidePro refs marker not found');
  source = source.replace(marker, marker + '\n  const rideSubmitRef = useRef(false);');
}

const start = source.indexOf('  const handleRequestRide = async () => {');
const end = source.indexOf('\n\n  const handleCancelRide', start);
if (start < 0 || end < 0) throw new Error('MapRidePro ride request handler not found');

const block = source.slice(start, end);
if (!block.includes('rideSubmitRef.current')) {
  const guarded = block
    .replace("  const handleRequestRide = async () => {\n    if (!token)", "  const handleRequestRide = async () => {\n    if (rideSubmitRef.current || busy) return;\n    if (!token)")
    .replace("    setBusy(true); setError('');", "    rideSubmitRef.current = true;\n    setBusy(true); setError('');")
    .replace("    } finally {\n      setBusy(false);\n    }", "    } finally {\n      rideSubmitRef.current = false;\n      setBusy(false);\n    }");
  source = source.slice(0, start) + guarded + source.slice(end);
}

fs.writeFileSync(file, source, 'utf8');
console.log('[fix-ride-submit-guard] Duplicate ride submission guard applied.');
