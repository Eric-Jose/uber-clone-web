const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appCss = path.join(root, 'src', 'App.css');
const mapFile = path.join(root, 'src', 'pages', 'MapRidePro.js');

const cssMarker = '/* MAP_BLACK_SCREEN_HARDENING */';
const cssPatch = `\n${cssMarker}\n/* Keep Leaflet visible even when the parent layout is initialized before mobile viewport sizing. */\n#root .leaflet-container {\n  width: 100% !important;\n  min-height: 100svh;\n  height: 100% !important;\n  background: #d9dde3 !important;\n  z-index: 0;\n}\n#root .leaflet-pane, #root .leaflet-tile-pane { z-index: 1; }\n#root .leaflet-overlay-pane { z-index: 2; }\n#root .leaflet-marker-pane { z-index: 3; }\n#root .leaflet-control-container { z-index: 10; }\n@supports not (height: 100svh) {\n  #root .leaflet-container { min-height: 100vh; }\n}\n`;

if (fs.existsSync(appCss)) {
  let css = fs.readFileSync(appCss, 'utf8');
  if (!css.includes(cssMarker)) {
    fs.appendFileSync(appCss, cssPatch, 'utf8');
  }
}

if (fs.existsSync(mapFile)) {
  let source = fs.readFileSync(mapFile, 'utf8');
  const marker = '/* MAP_BLACK_SCREEN_RUNTIME_HARDENING */';
  if (!source.includes(marker)) {
    const needle = 'map.current = mapInstance;';
    const runtimePatch = `\n    ${marker}\n    const refreshLeafletSize = () => {\n      try { mapInstance.invalidateSize({ animate: false, pan: false }); } catch (_) {}\n    };\n    requestAnimationFrame(refreshLeafletSize);\n    setTimeout(refreshLeafletSize, 120);\n    setTimeout(refreshLeafletSize, 500);\n    window.addEventListener('resize', refreshLeafletSize);\n    window.addEventListener('orientationchange', refreshLeafletSize);`;
    if (source.includes(needle)) {
      source = source.replace(needle, needle + runtimePatch);
      source = source.replace(
        "mapInstance.remove();\n      map.current = null;",
        "window.removeEventListener('resize', refreshLeafletSize);\n      window.removeEventListener('orientationchange', refreshLeafletSize);\n      mapInstance.remove();\n      map.current = null;"
      );
      fs.writeFileSync(mapFile, source, 'utf8');
    }
  }
}

console.log('[map-fix] Leaflet black-screen hardening applied.');
