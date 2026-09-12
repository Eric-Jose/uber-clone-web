const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'src/pages/MapRidePro.js');
const cssPath = path.join(root, 'src/styles/PrecoFixo17Reference.css');

let map = fs.readFileSync(mapPath, 'utf8');
let changed = false;

const oldImport = "import { dispatchRideSearch } from '../services/rideDispatch';";
const newImport = "import { cancelRideSearchRetry, dispatchRideSearch } from '../services/rideDispatch';";
if (map.includes(oldImport) && !map.includes('cancelRideSearchRetry')) {
  map = map.replace(oldImport, newImport);
  changed = true;
}

const cancelAnchor = "clearInterval(pollTimer.current);\n      setCurrentRideId(null); setRide(null); setDriver(null); setDriverLocation(null); setStage('plan');";
const cancelReplacement = "clearInterval(pollTimer.current);\n      cancelRideSearchRetry(currentRideId);\n      setCurrentRideId(null); setRide(null); setDriver(null); setDriverLocation(null); setStage('plan');";
if (map.includes(cancelAnchor) && !map.includes('cancelRideSearchRetry(currentRideId);')) {
  map = map.replace(cancelAnchor, cancelReplacement);
  changed = true;
}

const finishAnchor = "clearInterval(pollTimer.current);\n      clearInterval(elapsedTimer.current);\n      setCurrentRideId(null);";
const finishReplacement = "clearInterval(pollTimer.current);\n      clearInterval(elapsedTimer.current);\n      cancelRideSearchRetry(currentRideId);\n      setCurrentRideId(null);";
if (map.includes(finishAnchor)) {
  map = map.replace(finishAnchor, finishReplacement);
  changed = true;
}

const terminalAnchor = "if (['COMPLETED', 'CANCELLED'].includes(nextRide.status)) {\n          clearInterval(pollTimer.current);\n          setCurrentRideId(null);\n        }";
const terminalReplacement = "if (['COMPLETED', 'CANCELLED'].includes(nextRide.status)) {\n          clearInterval(pollTimer.current);\n          cancelRideSearchRetry(nextRide.id);\n          setCurrentRideId(null);\n        }";
if (map.includes(terminalAnchor) && !map.includes('cancelRideSearchRetry(nextRide.id);')) {
  map = map.replace(terminalAnchor, terminalReplacement);
  changed = true;
}

if (changed) fs.writeFileSync(mapPath, map);

const cssMarker = '/* PF17_PASSENGER_RIDE_POLISH_V1 */';
const cssPatch = `\n\n${cssMarker}\n/* Mobile-first ride experience: safe areas, compact sheets, larger touch targets and stable viewport behavior. */\n.pf-map-screen {\n  min-height: 100svh !important;\n  height: 100svh !important;\n  padding-bottom: env(safe-area-inset-bottom, 0px);\n  touch-action: manipulation;\n}\n.pf-map-canvas {\n  height: 100svh !important;\n}\n.pf-map-topbar {\n  height: 56px !important;\n  padding-top: env(safe-area-inset-top, 0px) !important;\n  box-sizing: content-box !important;\n}\n.pf-map-icon-btn, .pf-route-add-btn, .pf-driver-call-btn {\n  -webkit-tap-highlight-color: transparent;\n  touch-action: manipulation;\n}\n.pf-route-card {\n  top: calc(64px + env(safe-area-inset-top, 0px)) !important;\n  max-height: min(34svh, 250px);\n  overflow: visible;\n}\n.pf-bottom-sheet, .pf-arriving-sheet, .pf-progress-sheet {\n  bottom: max(12px, env(safe-area-inset-bottom, 12px)) !important;\n  max-height: min(44svh, 390px);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  -webkit-overflow-scrolling: touch;\n}\n.pf-request-btn, .pf-arriving-cancel-btn, .pf-finish-btn {\n  min-height: 52px;\n  touch-action: manipulation;\n}\n.pf-suggest-dropdown {\n  max-height: min(34svh, 280px) !important;\n  overscroll-behavior: contain;\n  -webkit-overflow-scrolling: touch;\n}\n.pf-suggest-item {\n  min-height: 48px;\n}\n.pf-map-screen input, .pf-map-screen button {\n  font-family: inherit;\n}\n@media (max-height: 700px) {\n  .pf-route-card { padding: 10px 12px !important; }\n  .pf-bottom-sheet, .pf-arriving-sheet, .pf-progress-sheet { padding: 14px !important; }\n  .pf-sheet-car-thumb { width: 82px !important; }\n  .pf-sheet-price-val { font-size: 24px !important; }\n  .pf-sheet-chips { margin-bottom: 10px !important; }\n}\n@media (min-width: 768px) {\n  .pf-route-card, .pf-bottom-sheet, .pf-arriving-sheet, .pf-progress-sheet, .pf-driver-arriving-card, .pf-progress-banner {\n    max-width: 520px !important;\n  }\n}\n`;

let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes(cssMarker)) {
  fs.writeFileSync(cssPath, css + cssPatch);
}

console.log(`Passenger ride polish: ${changed ? 'MapRidePro lifecycle patched; ' : 'lifecycle already patched; '}visual mobile layer verified.`);
