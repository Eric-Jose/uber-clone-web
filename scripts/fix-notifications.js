const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patch(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let source = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (!source.includes(from) || source.includes(to)) continue;
    source = source.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, source, 'utf8');
}

// Keep this build-time cleanup idempotent. The app source already owns the
// notification badge; this script only removes demo notifications and adds
// real Socket.IO notification listeners when they are not already present.
const notificationPath = path.join(root, 'src/pages/NotificationCenter.js');
patch(notificationPath, [
  [
    "const DEFAULT_NOTIFICATIONS = [\n  { id: 1, type: 'driver', title: 'Motorista a caminho', message: 'O motorista Carlos está a caminho do seu local.', timeAgo: 'agora', read: false },\n  { id: 2, type: 'completed', title: 'Corrida concluída', message: 'Sua corrida foi concluída com sucesso.', timeAgo: 'há 10 min', read: false },\n  { id: 3, type: 'promo', title: 'Promoção', message: 'Ganhe desconto especial na sua próxima viagem pelo PreçoFixo17.', timeAgo: 'há 2 h', read: true },\n  { id: 4, type: 'system', title: 'Atualização', message: 'Nova versão disponível com melhorias.', timeAgo: 'há 1 dia', read: true }\n];",
    "const DEFAULT_NOTIFICATIONS = [];"
  ],
  [
    "return Array.isArray(saved) ? saved : DEFAULT_NOTIFICATIONS;",
    "if (!Array.isArray(saved)) return DEFAULT_NOTIFICATIONS;\n      const simulatedTitles = new Set(['Motorista a caminho', 'Corrida concluída', 'Promoção', 'Atualização']);\n      const cleaned = saved.filter((item) => !simulatedTitles.has(item?.title));\n      if (cleaned.length !== saved.length) localStorage.setItem(key, JSON.stringify(cleaned));\n      return cleaned;"
  ]
]);

const websocketPath = path.join(root, 'src/services/WebSocketService.js');
patch(websocketPath, [
  [
    "import { BACKEND_URL } from '../config';\n",
    "import { BACKEND_URL } from '../config';\nimport { addInAppNotification } from './notificationService';\n"
  ],
  [
    "    this.notificationsBound = false;",
    "    this.notificationsBound = false;"
  ],
  [
    "    this.bindPassengerCancellationRefresh();\n    return this.socket;",
    "    this.bindPassengerCancellationRefresh();\n    this.bindNotificationEvents();\n    return this.socket;"
  ],
  [
    "  requestDriverRoom() {",
    "  bindNotificationEvents() {\n    if (this.notificationsBound || !this.socket) return;\n    this.notificationsBound = true;\n    const user = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; } })();\n    const isPassenger = user?.userType !== 'driver';\n    const add = (event, type, title, message, allowed = true) => {\n      this.socket.on(event, (payload) => {\n        if (!allowed) return;\n        const rideId = payload?.rideId || payload?.ride?.id || 'unknown';\n        addInAppNotification({ id: `${event}-${rideId}`, type, title, message: typeof message === 'function' ? message(payload) : message });\n      });\n    };\n    add('ride-accepted', 'driver', 'Motorista encontrado', 'Um motorista aceitou sua corrida.', isPassenger);\n    add('ride-started', 'driver', 'Corrida iniciada', 'Sua corrida foi iniciada pelo motorista.', isPassenger);\n    add('ride-ended', 'completed', 'Corrida concluída', 'Sua corrida foi concluída com sucesso.', isPassenger);\n    add('ride-completed', 'completed', 'Corrida concluída', 'Sua corrida foi concluída com sucesso.', isPassenger);\n    add('ride-cancelled', 'system', 'Corrida cancelada', 'A corrida foi cancelada.', true);\n    add('new-ride-request', 'driver', 'Nova corrida', 'Você recebeu uma nova solicitação de corrida.', !isPassenger);\n  }\n\n  requestDriverRoom() {"
  ],
  [
    "    this.cancelRefreshBound = false;\n  }",
    "    this.cancelRefreshBound = false;\n    this.notificationsBound = false;\n  }"
  ]
]);

console.log('[fix-notifications] Idempotent notification cleanup complete.');
