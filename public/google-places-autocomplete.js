(function () {
  'use strict';

  function notifyReact(input) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, input.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function attach() {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    var inputs = document.querySelectorAll('input[type="text"]');
    inputs.forEach(function (input) {
      if (input.dataset.googlePlacesAttached === '1') return;
      if (!input.closest('.panel')) return;
      input.dataset.googlePlacesAttached = '1';

      var autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['formatted_address', 'geometry', 'name', 'place_id'],
        componentRestrictions: { country: 'br' },
        types: ['geocode']
      });

      autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;
        input.value = place.formatted_address || place.name || input.value;
        input.dataset.googlePlaceLat = String(place.geometry.location.lat());
        input.dataset.googlePlaceLng = String(place.geometry.location.lng());
        input.dataset.googlePlaceId = place.place_id || '';
        notifyReact(input);
      });
    });
  }

  function start() {
    attach();
    var observer = new MutationObserver(attach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(attach, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
