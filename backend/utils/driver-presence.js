const DRIVER_LOCATION_FRESH_MS = Math.max(10000, Number(process.env.DRIVER_LOCATION_FRESH_MS) || 30000);

function timestampFrom(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isDriverPresenceFresh(driver = {}, location = null, now = Date.now()) {
  const timestamp = timestampFrom(driver.lastLocationUpdate) || timestampFrom(location?.timestamp);
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= DRIVER_LOCATION_FRESH_MS;
}

module.exports = { DRIVER_LOCATION_FRESH_MS, isDriverPresenceFresh };
