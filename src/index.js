import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './home-enhancements.css';
import './map-dark-theme.css';
import './search-bottom.css';
import './styles/PassengerTouchFix.css';
import App from './App';

// GPS resilience: Chrome/mobile location providers can occasionally return
// TIMEOUT/POSITION_UNAVAILABLE even after permission was granted. The driver
// dashboard already uses watchPosition; this wrapper transparently retries a
// fresh position so the driver does not remain online with a stale location.
(function installGpsResilience() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  var geo = navigator.geolocation;
  var nativeWatch = geo.watchPosition.bind(geo);
  var nativeClear = geo.clearWatch.bind(geo);
  var nativeGet = geo.getCurrentPosition.bind(geo);
  var nextId = 100000;
  var watches = new Map();

  geo.watchPosition = function (success, error, options) {
    var id = nextId++;
    var active = true;
    var nativeId = null;
    var retryTimer = null;
    var delivered = false;
    var retrying = false;

    function cleanup() {
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      if (nativeId !== null) nativeClear(nativeId);
      nativeId = null;
      watches.delete(id);
    }

    function deliver(position) {
      if (!active) return;
      delivered = true;
      retrying = false;
      if (typeof success === 'function') success(position);
    }

    function retry() {
      if (!active || delivered || retrying) return;
      retrying = true;
      nativeGet(deliver, function (retryError) {
        retrying = false;
        if (!active) return;
        // Permission denial is permanent until the user changes browser/device
        // settings; do not hammer the location provider in that case.
        if (retryError && retryError.code === 1) {
          if (typeof error === 'function') error(retryError);
          return;
        }
        retryTimer = setTimeout(retry, 5000);
      }, Object.assign({}, options || {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }));
    }

    nativeId = nativeWatch(deliver, function (watchError) {
      if (!active) return;
      if (watchError && watchError.code === 1) {
        if (typeof error === 'function') error(watchError);
        return;
      }
      retry();
      if (typeof error === 'function') error(watchError);
    }, Object.assign({}, options || {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 }));

    watches.set(id, cleanup);
    return id;
  };

  geo.clearWatch = function (id) {
    var cleanup = watches.get(id);
    if (cleanup) cleanup();
    else nativeClear(id);
  };
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
