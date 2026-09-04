(function () {
  'use strict';

  var watchTimer = null;
  var lastOrigin = null;
  var attachedInputs = new Map();

  function getOrigin() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(lastOrigin);
      navigator.geolocation.getCurrentPosition(function (position) {
        lastOrigin = { lat: position.coords.latitude, lng: position.coords.longitude };
        resolve(lastOrigin);
      }, function () { resolve(lastOrigin); }, {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 10000
      });
    });
  }

  function setReactValue(input, value) {
    var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function makeBounds(origin) {
    if (!origin || !window.google || !google.maps || !google.maps.LatLngBounds) return null;
    var lat = Number(origin.lat), lng = Number(origin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return new google.maps.LatLngBounds(
      new google.maps.LatLng(lat - 0.35, lng - 0.35),
      new google.maps.LatLng(lat + 0.35, lng + 0.35)
    );
  }

  function attachInput(input) {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    if (!input || !input.matches('input[type="text"]')) return;
    if (!input.closest('.panel')) return;

    var entry = attachedInputs.get(input);
    if (entry) {
      var bounds = makeBounds(lastOrigin);
      if (bounds && entry.autocomplete && entry.autocomplete.setBounds) entry.autocomplete.setBounds(bounds);
      return;
    }

    var options = {
      fields: ['formatted_address', 'geometry', 'name', 'place_id'],
      componentRestrictions: { country: 'br' },
      types: ['geocode']
    };
    var bounds = makeBounds(lastOrigin);
    if (bounds) {
      options.bounds = bounds;
      options.strictBounds = false;
    }

    var autocomplete = new google.maps.places.Autocomplete(input, options);
    attachedInputs.set(input, { autocomplete: autocomplete });
    input.dataset.googlePlacesAttached = '1';

    autocomplete.addListener('place_changed', function () {
      var place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;
      var selected = {
        lat: Number(place.geometry.location.lat()),
        lng: Number(place.geometry.location.lng()),
        address: place.formatted_address || place.name || input.value,
        placeId: place.place_id || ''
      };
      if (!Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) return;

      window.__uberGooglePlace = selected;
      input.dataset.googlePlaceLat = String(selected.lat);
      input.dataset.googlePlaceLng = String(selected.lng);
      input.dataset.googlePlaceId = selected.placeId;
      setReactValue(input, selected.address);
      input.dispatchEvent(new CustomEvent('uber-google-place-selected', {
        bubbles: true,
        detail: selected
      }));
    });
  }

  function attach() {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    document.querySelectorAll('input[type="text"]').forEach(attachInput);
  }

  function refreshOrigin() {
    getOrigin().then(function () {
      attachedInputs.forEach(function (entry) {
        var bounds = makeBounds(lastOrigin);
        if (bounds && entry.autocomplete && entry.autocomplete.setBounds) entry.autocomplete.setBounds(bounds);
      });
      attach();
    });
  }

  function start() {
    refreshOrigin();
    attach();
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(refreshOrigin, 10000);
    var observer = new MutationObserver(attach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
