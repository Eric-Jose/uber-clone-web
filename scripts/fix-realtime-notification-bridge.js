const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'src', 'services', 'WebSocketService.js');
let source = fs.readFileSync(target, 'utf8');

const marker = '// REALTIME_NOTIFICATION_BRIDGE';
if (source.includes(marker)) {
  console.log('[fix-realtime-notification-bridge] already applied');
  process.exit(0);
}

const oldEmit = `  _emit(event, payload) {\n    const callbacks = this.listeners.get(event);\n    if (callbacks) callbacks.forEach((callback) => { try { callback(payload); } catch (error) { console.error(\`Realtime listener \${event}:\`, error); } });\n  }`;

const newEmit = `  _emit(event, payload) {\n    // REALTIME_NOTIFICATION_BRIDGE\n    // Production uses HTTP polling on Vercel, so notifications must not depend\n    // on a persistent Socket.IO server. The event bridge writes only once per\n    // ride/event and the existing notification UI reacts to the storage event.\n    try {\n      const user = JSON.parse(localStorage.getItem('user') || 'null');\n      const isPassenger = user?.userType !== 'driver';\n      const rideId = payload?.rideId || payload?.ride?.id || 'unknown';\n      const messages = {\n        'ride-accepted': ['driver', 'Motorista encontrado', 'Um motorista aceitou sua corrida.', isPassenger],\n        'ride-started': ['driver', 'Corrida iniciada', 'Sua corrida foi iniciada pelo motorista.', isPassenger],\n        'ride-ended': ['completed', 'Corrida concluída', 'Sua corrida foi concluída com sucesso.', isPassenger],\n        'ride-completed': ['completed', 'Corrida concluída', 'Sua corrida foi concluída com sucesso.', isPassenger],\n        'ride-cancelled': ['system', 'Corrida cancelada', 'A corrida foi cancelada.', true],\n        'ride-unavailable': ['system', 'Corrida indisponível', 'A solicitação de corrida não está mais disponível.', !isPassenger],\n        'new-ride-request': ['driver', 'Nova corrida', 'Você recebeu uma nova solicitação de corrida.', !isPassenger],\n      };\n      const item = messages[event];\n      if (item && item[3]) {\n        addInAppNotification({ id: \`realtime-\${event}-\${rideId}\`, type: item[0], title: item[1], message: item[2] });\n      }\n    } catch (_) {}\n    const callbacks = this.listeners.get(event);\n    if (callbacks) callbacks.forEach((callback) => { try { callback(payload); } catch (error) { console.error(\`Realtime listener \${event}:\`, error); } });\n  }`;

if (!source.includes(oldEmit)) throw new Error('WebSocketService _emit block not found; refusing unsafe patch.');
source = source.replace(oldEmit, newEmit);
fs.writeFileSync(target, source, 'utf8');
console.log('[fix-realtime-notification-bridge] production HTTP realtime events now feed the in-app notification center.');
