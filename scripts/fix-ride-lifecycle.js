const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('const isPassenger =')) {
  const marker = "  const token = localStorage.getItem('token');";
  if (!source.includes(marker)) throw new Error('MapRidePro token marker not found');
  source = source.replace(marker, marker + "\n  let currentUser = null;\n  try { currentUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}\n  const isPassenger = currentUser?.userType === 'passenger';");
}

const cancelStart = source.indexOf('  const handleCancelRide = async () => {');
const cancelEnd = source.indexOf('\n\n  const handleFinishRide', cancelStart);
if (cancelStart < 0 || cancelEnd < 0) throw new Error('MapRidePro cancellation handler not found');
const cancelBlock = `  const handleCancelRide = async () => {\n    if (!currentRideId) { setStage('plan'); return; }\n    setBusy(true);\n    setError('');\n    try {\n      const response = await fetch(\`${'${B}'}/api/rides/${'${currentRideId}'}/status\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelado pelo passageiro' }) });\n      const data = await response.json().catch(() => ({}));\n      if (!response.ok) throw new Error(data?.error || 'Não foi possível cancelar a corrida.');\n      clearInterval(pollTimer.current);\n      setCurrentRideId(null); setRide(null); setDriver(null); setDriverLocation(null); setStage('plan');\n      showToast('Corrida cancelada.');\n    } catch (cancelError) {\n      setError(cancelError?.message || 'Não foi possível cancelar a corrida.');\n    } finally {\n      setBusy(false);\n    }\n  };`;
source = source.slice(0, cancelStart) + cancelBlock + source.slice(cancelEnd);

const finishStart = source.indexOf('  const handleFinishRide = async () => {');
const finishEnd = source.indexOf('\n\n  const formatElapsed', finishStart);
if (finishStart < 0 || finishEnd < 0) throw new Error('MapRidePro finish handler not found');
const finishBlock = `  const handleFinishRide = async () => {\n    if (isPassenger) {\n      setError('A finalização da corrida é feita pelo motorista ao chegar ao destino.');\n      return;\n    }\n    if (!currentRideId) return;\n    setBusy(true);\n    setError('');\n    try {\n      const response = await fetch(\`${'${B}'}/api/rides/${'${currentRideId}'}/status\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ status: 'COMPLETED' }) });\n      const data = await response.json().catch(() => ({}));\n      if (!response.ok) throw new Error(data?.error || 'Não foi possível finalizar a corrida.');\n      clearInterval(pollTimer.current);\n      clearInterval(elapsedTimer.current);\n      setCurrentRideId(null);\n      setRide(data?.ride || { ...(ride || {}), status: 'COMPLETED' });\n      onNavigate?.('payment');\n    } catch (finishError) {\n      setError(finishError?.message || 'Não foi possível finalizar a corrida.');\n    } finally {\n      setBusy(false);\n    }\n  };`;
source = source.slice(0, finishStart) + finishBlock + source.slice(finishEnd);

const oldButton = "<button type=\"button\" className=\"pf-finish-btn\" disabled={busy} onClick={handleFinishRide}>{busy?'Finalizando…':'Finalizar corrida'}</button>";
const newButton = "<button type=\"button\" className=\"pf-finish-btn\" disabled={busy || isPassenger} onClick={handleFinishRide}>{busy?'Finalizando…':isPassenger?'Aguardando motorista finalizar':'Finalizar corrida'}</button>";
if (source.includes(oldButton)) source = source.replace(oldButton, newButton);

fs.writeFileSync(file, source, 'utf8');
console.log('[fix-ride-lifecycle] Passenger cancellation and driver-only completion guards applied.');
