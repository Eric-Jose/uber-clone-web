const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'pages', 'MapRidePro.js');
if (!fs.existsSync(file)) throw new Error('MapRidePro.js não encontrado.');

let source = fs.readFileSync(file, 'utf8');
const importLine = "import { dispatchRideSearch } from '../services/rideDispatch';\n";
const callLine = "      // Keep automatic dispatch alive if the first driver wave does not find an online driver.\n      void dispatchRideSearch(createdRide.id, token);\n";

if (source.includes(importLine)) source = source.replace(importLine, '');
if (source.includes(callLine)) source = source.replace(callLine, '');

if (source.includes('dispatchRideSearch(createdRide.id')) {
  throw new Error('Falha ao remover o dispatcher legado de MapRidePro.js.');
}

fs.writeFileSync(file, source);
console.log('OK: despacho duplicado do cliente removido; o backend unificado é a única autoridade de dispatch.');
