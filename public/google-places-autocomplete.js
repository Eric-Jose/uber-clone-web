(function () {
  'use strict';

  var watchTimer = null;
  var lastOrigin = null;

  function getOrigin() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
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

  function notifyReact(input) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, input.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function attachInput(input) {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    if (!input || input.dataset.googlePlacesAttached === '1') return;
    if (!input.closest('.panel')) return;

    input.dataset.googlePlacesAttached = '1';
    var options = {
      fields: ['formatted_address', 'geometry', 'name', 'place_id'],
      componentRestrictions: { country: 'br' },
      types: ['geocode']
    };

    if (lastOrigin && google.maps.LatLngBounds) {
      var lat = lastOrigin.lat, lng = lastOrigin.lng;
      options.bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(lat - 0.45, lng - 0.45),
        new google.maps.LatLng(lat + 0.45, lng + 0.45)
      );
      options.strictBounds = false;
    }

    var autocomplete = new google.maps.places.Autocomplete(input, options);

    autocomplete.addListener('place_changed', function () {
      var place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;
      var address = place.formatted_address || place.name || input.value;
      input.value = address;
      input.dataset.googlePlaceLat = String(place.geometry.location.lat());
      input.dataset.googlePlaceLng = String(place.geometry.location.lng());
      input.dataset.googlePlaceId = place.place_id || '';
      window.__uberGooglePlace = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: address,
        placeId: place.place_id || ''
      };
      notifyReact(input);
      input.dispatchEvent(new CustomEvent('uber-google-place-selected', {
        bubbles: true,
        detail: window.__uberGooglePlace
      }));
    });
  }

  function attach() {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    document.querySelectorAll('input[type="text"]').forEach(attachInput);
  }

  function start() {
    getOrigin().then(attach);
    attach();
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(function () {
      getOrigin().then(attach);
    }, 10000);
    var observer = new MutationObserver(attach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
