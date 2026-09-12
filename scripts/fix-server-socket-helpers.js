const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(serverPath)) {
  console.log('fix-server-socket-helpers: server.js not found, skipping.');
  process.exit(0);
}

let source = fs.readFileSync(serverPath, 'utf8');
if (source.includes('async function findNearestDrivers(')) {
  console.log('fix-server-socket-helpers: helpers already present.');
  process.exit(0);
}

const marker = 'const auth = admin.auth();';
if (!source.includes(marker)) {
  throw new Error('fix-server-socket-helpers: insertion marker not found in server.js');
}

const helper = `\n\nfunction distanceKm(a, b) {\n  const lat1 = Number(a?.lat ?? a?.latitude);\n  const lon1 = Number(a?.lng ?? a?.longitude);\n  const lat2 = Number(b?.lat ?? b?.latitude);\n  const lon2 = Number(b?.lng ?? b?.longitude);\n  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;\n  const toRad = (value) => (value * Math.PI) / 180;\n  const dLat = toRad(lat2 - lat1);\n  const dLon = toRad(lon2 - lon1);\n  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;\n  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));\n}\n\nasync function findNearestDrivers(origin) {\n  const [usersSnapshot, locationsSnapshot] = await Promise.all([\n    db.ref('users').get(),\n    db.ref('locations').get(),\n  ]);\n  const users = usersSnapshot.val() || {};\n  const locations = locationsSnapshot.val() || {};\n  const originLocation = origin?.location || origin?.currentLocation || origin;\n  const drivers = [];\n  for (const [driverId, user] of Object.entries(users)) {\n    if (user?.userType !== 'driver' || user?.driverApprovalStatus !== 'approved' || user?.isOnline !== true) continue;\n    const location = user.currentLocation || locations[driverId];\n    const distance = distanceKm(originLocation, location);\n    if (Number.isFinite(distance)) drivers.push({ uid: driverId, distance });\n  }\n  return drivers.sort((a, b) => a.distance - b.distance);\n}\n\nasync function saveDriverLocation(driverId, latitude, longitude) {\n  const lat = Number(latitude);\n  const lng = Number(longitude);\n  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Localização do motorista inválida.');\n  const location = { latitude: lat, longitude: lng, lat, lng, timestamp: Date.now() };\n  await db.ref(\`locations/\${driverId}\`).set(location);\n  await db.ref(\`users/\${driverId}\`).update({\n    currentLocation: { lat, lng },\n    lastLocationUpdate: new Date().toISOString(),\n  });\n  return location;\n}\n`;

source = source.replace(marker, marker + helper);
fs.writeFileSync(serverPath, source, 'utf8');
console.log('fix-server-socket-helpers: restored findNearestDrivers/saveDriverLocation.');
