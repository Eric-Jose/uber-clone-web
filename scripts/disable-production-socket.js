const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'src', 'services', 'WebSocketService.js');
if (!fs.existsSync(target)) process.exit(0);

let source = fs.readFileSync(target, 'utf8');
const marker = 'const PRODUCTION_SOCKET_PATCH = true;';
if (source.includes(marker)) process.exit(0);

source = source.replace(
  'const POLL_MS = 2000;',
  `const POLL_MS = 2000;\nconst SOCKET_ENABLED = process.env.NODE_ENV !== 'production';\n${marker}`
);

source = source.replace(
  '    this._startPolling();\n    if (this.socket) {',
  '    this._startPolling();\n    if (!SOCKET_ENABLED) { this._emit(\'connect\'); return null; }\n    if (this.socket) {'
);

fs.writeFileSync(target, source);
