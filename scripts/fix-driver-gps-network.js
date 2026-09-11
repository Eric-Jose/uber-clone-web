const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'src/pages/DriverDashboardMapPro.js');
let source = fs.readFileSync(target, 'utf8');

const oldLocation = /  async function getFreshLocation\(\) \{[\s\S]*?\n  \}\n\n  function clearRide/;
const newLocation = `  async function getFreshLocation() {
    if (!navigator.geolocation) {
      if (driverLocation) return driverLocation;
      throw new Error('GPS indisponível neste dispositivo.');
    }

    function readPosition(options) {
      return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    }

    var attempts = [
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 }
    ];
    var lastGpsError = null;

    for (var i = 0; i < attempts.length; i += 1) {
      try {
        var position = await readPosition(attempts[i]);
        var loc = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
        if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) throw new Error('Localização inválida.');
        setDriverLocation(loc);
        return loc;
      } catch (gpsError) {
        lastGpsError = gpsError;
        if (gpsError && gpsError.code === 1) break;
      }
    }

    if (driverLocation) return driverLocation;
    if (lastGpsError && lastGpsError.code === 1) {
      throw new Error('Permissão de localização bloqueada. Ative a localização para o navegador e tente novamente.');
    }
    throw new Error('Não foi possível obter sua localização atual. Ative o GPS e tente novamente.');
  }

  function clearRide`;

if (!oldLocation.test(source)) throw new Error('getFreshLocation block not found');
source = source.replace(oldLocation, newLocation);

const oldSync = /  async function syncDriverLocationToServer\(loc\) \{[\s\S]*?\n  \}\n\n  useEffect\(function \(\) \{/;
const newSync = `  async function syncDriverLocationToServer(loc) {
    if (!loc || !uid) return;
    var lastError = null;
    for (var attempt = 1; attempt <= 3; attempt += 1) {
      try {
        var response = await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: true, currentLocation: loc }, { headers: headers, timeout: 15000 });
        if (!response || response.status < 200 || response.status >= 300) throw new Error('Não foi possível sincronizar a localização do motorista.');
        onlineRef.current = true;
        setOnline(true);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(function (resolve) { setTimeout(resolve, attempt * 1000); });
      }
    }
    throw lastError || new Error('Erro de rede ao sincronizar sua localização.');
  }

  useEffect(function () {`;
if (!oldSync.test(source)) throw new Error('syncDriverLocationToServer block not found');
source = source.replace(oldSync, newSync);

const oldToggle = /        var loc = await getFreshLocation\(\);\n        await axios\.post\(BACKEND_URL \+ '\/api\/drivers\/' \+ uid \+ '\/status', \{ isOnline: true, currentLocation: loc \}, \{ headers: headers, timeout: 12000 \}\);/;
const newToggle = `        var loc = await getFreshLocation();
        await syncDriverLocationToServer(loc);`;
if (!oldToggle.test(source)) throw new Error('toggle online block not found');
source = source.replace(oldToggle, newToggle);

const oldCatch = /    \} catch \(error\) \{\n      setMessage\(errorMessage\(error, 'Não foi possível alterar o status\.'\)\);/;
const newCatch = `    } catch (error) {
      var networkFailure = !!(error && (
        error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNABORTED' ||
        error.message === 'Network Error' ||
        (error.config && !error.response)
      ));
      setMessage(networkFailure ? 'Sem conexão com o servidor. Verifique sua internet e tente ficar online novamente.' : errorMessage(error, 'Não foi possível alterar o status.'));`;
if (!oldCatch.test(source)) throw new Error('toggle error handler not found');
source = source.replace(oldCatch, newCatch);

fs.writeFileSync(target, source);
console.log('Driver GPS/network resilience patch applied.');
