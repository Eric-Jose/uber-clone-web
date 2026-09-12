const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server.js');
let source = fs.readFileSync(file, 'utf8');

const marker = "const db = admin.database();\nconst auth = admin.auth();";
const replacement = "const db = admin.database();\n// PreçoFixo17: use exactly one Realtime Database instance per Vercel function.\n// Some route modules call admin.database() while being loaded after this file;\n// returning the already-created instance prevents Firebase from opening the same\n// app with differently formatted database URLs (e.g. trailing slash).\nif (!admin.__precofixo17DatabasePatched) {\n  const sharedDatabase = db;\n  admin.database = () => sharedDatabase;\n  admin.__precofixo17DatabasePatched = true;\n}\nconst auth = admin.auth();";

if (source.includes('admin.__precofixo17DatabasePatched')) {
  console.log('✅ Firebase DB singleton já aplicado.');
  process.exit(0);
}

if (!source.includes(marker)) {
  console.warn('⚠️ Não foi possível localizar o ponto seguro para o singleton Firebase DB.');
  process.exit(0);
}

source = source.replace(marker, replacement);
fs.writeFileSync(file, source, 'utf8');
console.log('✅ Firebase DB singleton aplicado ao backend Vercel.');
