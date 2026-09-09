import React from 'react';
import MapRidePro from './MapRidePro';

// Compatibility wrapper: all ride-map entry points use the same
// Leaflet/OpenStreetMap implementation. This prevents legacy Google Maps
// code (and its API-key requirement) from being loaded by older routes.
export default function MapRide(props) {
  return <MapRidePro {...props} />;
}
